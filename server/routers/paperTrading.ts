import { z } from "zod";
import { closeUserPaperTrade, createPaperTrade, getUserClosedPaperTrade, getUserPaperTradeCritique, getUserPaperTradingSummary, listUserPaperTrades, listUserSignals, saveUserPaperTradeCritique } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { getCandleHistoryCached } from "../candles";
import { assessSignalFollowThrough, summarizeSignalFollowThrough } from "../signalPerformance";
import { generatePaperTradeCritique } from "../tradeCritique";

const tradeInput = z.object({
  symbol: z.string().trim().min(1).max(32),
  exchange: z.string().trim().min(1).max(32),
  assetClass: z.enum(["crypto", "stock", "forex", "futures"]),
  side: z.enum(["long", "short"]),
  quantity: z.string().regex(/^\d+(\.\d+)?$/, "أدخل كمية رقمية موجبة."),
  entryPrice: z.string().regex(/^\d+(\.\d+)?$/, "أدخل سعر دخول رقميًا."),
  stopLoss: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  takeProfit: z.string().regex(/^\d+(\.\d+)?$/).optional(),
  note: z.string().trim().max(500).optional(),
});

export const paperTradingRouter = router({
  list: protectedProcedure.query(({ ctx }) => listUserPaperTrades(ctx.user.id)),
  summary: protectedProcedure.query(({ ctx }) => getUserPaperTradingSummary(ctx.user.id)),
  signalPerformance: protectedProcedure.query(async ({ ctx }) => {
    const signals = (await listUserSignals(ctx.user.id)).slice(0, 12);
    const results = await Promise.all(signals.map(async signal => {
      try {
        const history = await getCandleHistoryCached(signal.symbol, signal.exchange, "1d", "6mo");
        return assessSignalFollowThrough(signal, history.candles);
      } catch {
        return { id: signal.id, symbol: signal.symbol, exchange: signal.exchange, recommendation: signal.recommendation, status: "unavailable" as const, entryPrice: null, latestPrice: null, changePercent: null };
      }
    }));
    return summarizeSignalFollowThrough(results);
  }),
  open: protectedProcedure.input(tradeInput).mutation(({ ctx, input }) => createPaperTrade(ctx.user.id, input)),
  close: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), closePrice: z.string().regex(/^\d+(\.\d+)?$/) }))
    .mutation(({ ctx, input }) => closeUserPaperTrade(ctx.user.id, input.id, input.closePrice)),
  critique: router({
    get: protectedProcedure.input(z.object({ tradeId: z.number().int().positive() })).query(async ({ ctx, input }) => {
      const critique = await getUserPaperTradeCritique(ctx.user.id, input.tradeId);
      return critique?.content ?? null;
    }),
    generate: protectedProcedure.input(z.object({ tradeId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
      const trade = await getUserClosedPaperTrade(ctx.user.id, input.tradeId);
      if (!trade) throw new Error("لا يمكن إنشاء نقد إلا لصفقة مغلقة تملكها.");
      const signals = await listUserSignals(ctx.user.id);
      const signal = signals.find(item => item.symbol === trade.symbol && item.exchange === trade.exchange);
      const content = await generatePaperTradeCritique({ trade, signal: signal ? { timeframe: signal.timeframe, recommendation: signal.recommendation, confidence: signal.confidence, summary: signal.summary } : null });
      return saveUserPaperTradeCritique(ctx.user.id, input.tradeId, content);
    }),
  }),
});

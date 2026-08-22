import { z } from "zod";
import { closeUserPaperTrade, createPaperTrade, getUserPaperTradingSummary, listUserPaperTrades, listUserSignals } from "../db";
import { protectedProcedure, router } from "../_core/trpc";
import { getCandleHistoryCached } from "../candles";
import { assessSignalFollowThrough, summarizeSignalFollowThrough } from "../signalPerformance";

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
});

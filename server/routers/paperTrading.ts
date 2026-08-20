import { z } from "zod";
import { closeUserPaperTrade, createPaperTrade, listUserPaperTrades } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

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
  open: protectedProcedure.input(tradeInput).mutation(({ ctx, input }) => createPaperTrade(ctx.user.id, input)),
  close: protectedProcedure
    .input(z.object({ id: z.number().int().positive(), closePrice: z.string().regex(/^\d+(\.\d+)?$/) }))
    .mutation(({ ctx, input }) => closeUserPaperTrade(ctx.user.id, input.id, input.closePrice)),
});

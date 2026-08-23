import { z } from "zod";
import { createUserSignal, deleteUserSignal, enablePublicSignalShare, getPublicSignal, listUserSignals } from "../db";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

export const signalsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listUserSignals(ctx.user.id)),
  save: protectedProcedure
    .input(
      z.object({
        symbol: z.string().trim().min(1).max(32),
        exchange: z.string().trim().min(1).max(32),
        timeframe: z.string().trim().min(1).max(8),
        recommendation: z.enum(["strong_buy", "buy", "neutral", "sell", "strong_sell"]),
        confidence: z.number().int().min(0).max(100),
        summary: z.string().trim().min(1).max(2_000),
        analysisPayload: z.record(z.string(), z.unknown()),
        sharePublic: z.boolean().default(false),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { sharePublic, ...signal } = input;
      return createUserSignal(ctx.user.id, { ...signal, symbol: signal.symbol.toUpperCase(), exchange: signal.exchange.toUpperCase() }, sharePublic);
    }),
  share: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => enablePublicSignalShare(ctx.user.id, input.id)),
  getPublicSignal: publicProcedure
    .input(z.object({ shareId: z.string().uuid() }))
    .query(({ input }) => getPublicSignal(input.shareId)),
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => deleteUserSignal(ctx.user.id, input.id)),
});

import { z } from "zod";
import { createUserSignal, deleteUserSignal, listUserSignals } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

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
      }),
    )
    .mutation(({ ctx, input }) =>
      createUserSignal(ctx.user.id, { ...input, symbol: input.symbol.toUpperCase(), exchange: input.exchange.toUpperCase() }),
    ),
  delete: protectedProcedure
    .input(z.object({ id: z.number().int().positive() }))
    .mutation(({ ctx, input }) => deleteUserSignal(ctx.user.id, input.id)),
});

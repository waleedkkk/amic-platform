import { z } from "zod";
import { cancelUserStructureAlert, createUserStructureAlert, listUserStructureAlerts } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const structureAlertInput = z.object({
  symbol: z.string().trim().min(1).max(32),
  exchange: z.string().trim().min(1).max(32),
  interval: z.enum(["5m", "15m", "1h", "4h", "1d", "1wk"]),
  eventType: z.enum(["breakout", "breakdown", "bullish_reversal", "bearish_reversal"]),
});

export const structureAlertsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listUserStructureAlerts(ctx.user.id)),
  create: protectedProcedure.input(structureAlertInput).mutation(({ ctx, input }) => createUserStructureAlert(ctx.user.id, input)),
  cancel: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => cancelUserStructureAlert(ctx.user.id, input.id)),
});

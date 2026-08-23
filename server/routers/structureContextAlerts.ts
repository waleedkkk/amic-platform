import { z } from "zod";
import { cancelUserStructureContextAlert, createUserStructureContextAlert, listUserStructureContextAlerts } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const contextAlertInput = z.object({
  symbol: z.string().trim().min(1).max(32).transform(value => value.toUpperCase()),
  exchange: z.string().trim().min(1).max(32).transform(value => value.toUpperCase()),
  interval: z.enum(["5m", "15m", "1h", "4h", "1d", "1wk"]),
  sourceKind: z.enum(["support", "resistance", "demand_zone", "supply_zone"]),
  sourceLabel: z.string().trim().min(3).max(160),
  referencePrice: z.string().trim().min(1).max(32),
  rangeLow: z.string().trim().max(32).nullable().optional(),
  rangeHigh: z.string().trim().max(32).nullable().optional(),
  invalidationPrice: z.string().trim().max(32).nullable().optional(),
  eventType: z.enum(["approach", "touch", "invalidation"]),
  proximityBps: z.number().int().min(1).max(100).default(15),
});

export const structureContextAlertsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listUserStructureContextAlerts(ctx.user.id)),
  create: protectedProcedure.input(contextAlertInput).mutation(({ ctx, input }) => createUserStructureContextAlert(ctx.user.id, input)),
  cancel: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => cancelUserStructureContextAlert(ctx.user.id, input.id)),
});

import { z } from "zod";
import { DEFAULT_ORDER_FLOW_PREFERENCES, MAX_LARGE_TRADE_NOTIONAL, MIN_LARGE_TRADE_NOTIONAL, ORDER_FLOW_DEPTH_LEVEL_OPTIONS, normalizeOrderFlowPreferences } from "../../shared/orderFlowPreferences";
import { getUserOrderFlowPreferences, saveUserOrderFlowPreferences } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const preferencesInput = z.object({
  largeTradeMinNotional: z.number().int().min(MIN_LARGE_TRADE_NOTIONAL).max(MAX_LARGE_TRADE_NOTIONAL),
  depthLevels: z.union(ORDER_FLOW_DEPTH_LEVEL_OPTIONS.map(value => z.literal(value)) as [z.ZodLiteral<5>, z.ZodLiteral<10>, z.ZodLiteral<20>]),
});

export const orderFlowPreferencesRouter = router({
  getPreferences: protectedProcedure.query(async ({ ctx }) => {
    const preferences = await getUserOrderFlowPreferences(ctx.user.id);
    return normalizeOrderFlowPreferences(preferences ?? DEFAULT_ORDER_FLOW_PREFERENCES);
  }),
  savePreferences: protectedProcedure.input(preferencesInput).mutation(async ({ ctx, input }) => {
    const preferences = normalizeOrderFlowPreferences(input);
    await saveUserOrderFlowPreferences(ctx.user.id, preferences);
    return preferences;
  }),
});

import { getEconomicCalendarSubscription, saveDailyMarketDigestSubscription, saveEconomicCalendarSubscription } from "../db";
import { fetchOfficialEconomicCalendar } from "../../shared/economicCalendar";
import { createDailyMarketDigest } from "../dailyMarketDigest";
import { cached } from "./market";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { z } from "zod";

const subscriptionInput = z.object({
  enabled: z.boolean(),
  highImpactOnly: z.boolean().default(true),
  countries: z.array(z.literal("United States")).min(1).max(1).default(["United States"]),
  preAlertMinutes: z.literal(60).default(60),
});

export const economicCalendarRouter = router({
  upcoming: publicProcedure.query(() => cached("economic-calendar:official-us:v1", "calendar", "US", "1h", 60 * 60, fetchOfficialEconomicCalendar)),
  subscription: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const subscription = await getEconomicCalendarSubscription(ctx.user.id);
      return subscription
        ? { enabled: Boolean(subscription.enabled), dailyDigestEnabled: Boolean(subscription.dailyDigestEnabled), highImpactOnly: Boolean(subscription.highImpactOnly), countries: subscription.countries, preAlertMinutes: subscription.preAlertMinutes }
        : { enabled: false, dailyDigestEnabled: false, highImpactOnly: true, countries: ["United States"], preAlertMinutes: 60 };
    }),
    save: protectedProcedure.input(subscriptionInput).mutation(({ ctx, input }) => saveEconomicCalendarSubscription(ctx.user.id, input)),
  }),
  digest: router({
    preview: protectedProcedure.query(createDailyMarketDigest),
    save: protectedProcedure.input(z.object({ enabled: z.boolean() })).mutation(({ ctx, input }) => saveDailyMarketDigestSubscription(ctx.user.id, input.enabled)),
  }),
});

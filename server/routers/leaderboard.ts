import { z } from "zod";
import { getPaperTradingLeaderboardProfile, listPaperTradingLeaderboard, savePaperTradingLeaderboardProfile } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const profileInput = z.object({ enabled: z.boolean(), displayName: z.string().trim().min(2).max(40).regex(/^[A-Za-z0-9\u0600-\u06FF _.-]+$/, "استخدم اسم عرض دون بريد أو روابط."), anonymized: z.boolean() });

export const leaderboardRouter = router({
  list: protectedProcedure.query(listPaperTradingLeaderboard),
  profile: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const profile = await getPaperTradingLeaderboardProfile(ctx.user.id);
      return profile ? { enabled: Boolean(profile.enabled), displayName: profile.displayName, anonymized: Boolean(profile.anonymized) } : { enabled: false, displayName: "متداول AMIC", anonymized: true };
    }),
    save: protectedProcedure.input(profileInput).mutation(({ ctx, input }) => savePaperTradingLeaderboardProfile(ctx.user.id, input)),
  }),
});

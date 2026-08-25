import { z } from "zod";
import { COOKIE_NAME } from "@shared/const";
import { users } from "../drizzle/schema";
import { getSessionCookieOptions } from "./_core/cookies";
import { systemRouter } from "./_core/systemRouter";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import {
  AuthError,
  createUserWithEmail,
  setSessionCookie,
  signInWithEmail,
  clearSessionCookie,
} from "./localAuth";
import { getDb } from "./db";
import { aiRouter } from "./routers/ai";
import { adminAiRouter } from "./routers/adminAi";
import { adminDashboardRouter } from "./routers/adminDashboard";
import { alertCenterRouter } from "./routers/alertCenter";
import { adminHeartbeatRouter } from "./routers/adminHeartbeat";
import { backtestRouter } from "./routers/backtest";
import { leaderboardRouter } from "./routers/leaderboard";
import { economicCalendarRouter } from "./routers/economicCalendar";
import { marketRouter } from "./routers/market";
import { metalAlertsRouter } from "./routers/metalAlerts";
import { paperTradingRouter } from "./routers/paperTrading";
import { orderFlowPreferencesRouter } from "./routers/orderFlowPreferences";
import { signalsRouter } from "./routers/signals";
import { structureAlertsRouter } from "./routers/structureAlerts";
import { structureContextAlertsRouter } from "./routers/structureContextAlerts";

const emailInput = z.object({
  email: z.string().min(1).max(320),
  password: z.string().min(1).max(128),
  name: z.string().max(120).optional(),
});

export const appRouter = router({
  system: systemRouter,
  auth: router({
    me: publicProcedure.query(opts =>
      opts.ctx.user
        ? {
            id: opts.ctx.user.id,
            name: opts.ctx.user.name,
            email: opts.ctx.user.email,
            role: opts.ctx.user.role,
          }
        : null
    ),
    register: publicProcedure.input(emailInput).mutation(async ({ input, ctx }) => {
      const user = await createUserWithEmail(input.email, input.password, input.name);
      setSessionCookie(ctx.req, ctx.res, user);
      return { id: user.id, email: user.email, name: user.name, role: user.role } as const;
    }),
    login: publicProcedure.input(emailInput.omit({ name: true })).mutation(async ({ input, ctx }) => {
      const user = await signInWithEmail(input.email, input.password);
      setSessionCookie(ctx.req, ctx.res, user);
      return { id: user.id, email: user.email, name: user.name, role: user.role } as const;
    }),
    logout: publicProcedure.mutation(({ ctx }) => {
      clearSessionCookie(ctx.req, ctx.res);
      return { success: true } as const;
    }),
    admin: router({
      listUsers: protectedProcedure
        .use(({ ctx, next }) => {
          if (ctx.user?.role !== "admin") {
            throw new AuthError("not_signed_in", "تتطلب هذه العملية صلاحيات إدارية");
          }
          return next();
        })
        .query(async () => {
          const db = await getDb();
          if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا");
          const rows = await db
            .select({ id: users.id, name: users.name, email: users.email, role: users.role, loginMethod: users.loginMethod, lastSignedIn: users.lastSignedIn })
            .from(users);
          return rows;
      }),
      dashboard: adminDashboardRouter,
      ai: adminAiRouter,
      heartbeat: adminHeartbeatRouter,
    }),
  }),
  alertCenter: alertCenterRouter,
  market: marketRouter,
  orderFlow: orderFlowPreferencesRouter,
  economicCalendar: economicCalendarRouter,
  metalAlerts: metalAlertsRouter,
  structureAlerts: structureAlertsRouter,
  structureContextAlerts: structureContextAlertsRouter,
  paperTrading: paperTradingRouter,
  signals: signalsRouter,
  ai: aiRouter,
  backtest: backtestRouter,
  leaderboard: leaderboardRouter,
});

export type AppRouter = typeof appRouter;

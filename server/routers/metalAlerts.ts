import { z } from "zod";
import {
  cancelUserMetalAlert,
  createUserMetalAlert,
  getUserTelegramSettings,
  listUserMetalAlerts,
  listUserNotifications,
  markUserNotificationRead,
  saveUserTelegramSettings,
} from "../db";
import { ENV } from "../_core/env";
import { protectedProcedure, router } from "../_core/trpc";

const alertInput = z.object({
  metal: z.enum(["XAUUSD", "XAGUSD"]),
  direction: z.enum(["above", "below"]),
  targetPrice: z.string().trim().regex(/^\d+(?:\.\d{1,4})?$/, "أدخل سعرًا موجبًا صالحًا حتى أربع منازل عشرية."),
});

export const metalAlertsRouter = router({
  list: protectedProcedure.query(({ ctx }) => listUserMetalAlerts(ctx.user.id)),
  create: protectedProcedure.input(alertInput).mutation(({ ctx, input }) => createUserMetalAlert(ctx.user.id, input)),
  cancel: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => cancelUserMetalAlert(ctx.user.id, input.id)),
  notifications: protectedProcedure.query(({ ctx }) => listUserNotifications(ctx.user.id)),
  markNotificationRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => markUserNotificationRead(ctx.user.id, input.id)),
  telegram: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const settings = await getUserTelegramSettings(ctx.user.id);
      return { enabled: Boolean(settings?.enabled), chatId: settings?.chatId ?? "", botConfigured: Boolean(ENV.telegramBotToken) };
    }),
    save: protectedProcedure.input(z.object({ enabled: z.boolean(), chatId: z.string().trim().max(64).optional() })).mutation(({ ctx, input }) => saveUserTelegramSettings(ctx.user.id, input)),
  }),
});

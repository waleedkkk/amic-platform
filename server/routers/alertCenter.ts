import { z } from "zod";
import { listUserNotifications, markUserNotificationRead } from "../db";
import { protectedProcedure, router } from "../_core/trpc";

const category = z.enum(["all", "metal_alert", "structure_alert", "structure_context_alert"]);

function metadataSymbol(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || !("symbol" in metadata) || typeof metadata.symbol !== "string") return null;
  return metadata.symbol.toUpperCase();
}

export const alertCenterRouter = router({
  list: protectedProcedure
    .input(z.object({ category: category.default("all"), symbol: z.string().trim().max(32).optional(), unreadOnly: z.boolean().default(false) }).optional())
    .query(async ({ ctx, input }) => {
      const filter = input ?? { category: "all" as const, unreadOnly: false };
      const symbol = filter.symbol?.toUpperCase();
      const notifications = await listUserNotifications(ctx.user.id);
      return notifications.filter(notification => {
        if (filter.category !== "all" && notification.category !== filter.category) return false;
        if (filter.unreadOnly && notification.readAt) return false;
        if (symbol && metadataSymbol(notification.metadata) !== symbol) return false;
        return true;
      });
    }),
  markRead: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(({ ctx, input }) => markUserNotificationRead(ctx.user.id, input.id)),
});

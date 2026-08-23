import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const dbMocks = vi.hoisted(() => ({ listUserNotifications: vi.fn(), markUserNotificationRead: vi.fn() }));
vi.mock("../db", () => dbMocks);

import { alertCenterRouter } from "./alertCenter";

const context: TrpcContext = {
  user: { id: 91, openId: "alerts-user", name: "Alerts user", email: "alerts@example.com", loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
  req: {} as TrpcContext["req"], res: {} as TrpcContext["res"],
};

describe("alertCenterRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يعرض نتائج السياق المطابقة للرمز من سجل المستخدم الحالي فقط", async () => {
    dbMocks.listUserNotifications.mockResolvedValue([
      { id: 1, category: "structure_context_alert", readAt: null, metadata: { symbol: "XAUUSD" } },
      { id: 2, category: "metal_alert", readAt: null, metadata: { symbol: "XAGUSD" } },
      { id: 3, category: "structure_context_alert", readAt: new Date(), metadata: { symbol: "XAUUSD" } },
    ]);
    const result = await alertCenterRouter.createCaller(context).list({ category: "structure_context_alert", symbol: "xauusd", unreadOnly: true });
    expect(result).toHaveLength(1);
    expect(result[0]?.id).toBe(1);
    expect(dbMocks.listUserNotifications).toHaveBeenCalledWith(91);
  });

  it("يضع القراءة على سجل يملكه المستخدم الحالي", async () => {
    dbMocks.markUserNotificationRead.mockResolvedValue({ success: true });
    await alertCenterRouter.createCaller(context).markRead({ id: 7 });
    expect(dbMocks.markUserNotificationRead).toHaveBeenCalledWith(91, 7);
  });
});

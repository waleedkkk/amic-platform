import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const databaseMocks = vi.hoisted(() => ({
  cancelUserMetalAlert: vi.fn(),
  createUserMetalAlert: vi.fn(),
  getUserTelegramSettings: vi.fn(),
  listUserMetalAlerts: vi.fn(),
  listUserNotifications: vi.fn(),
  markUserNotificationRead: vi.fn(),
  saveUserTelegramSettings: vi.fn(),
}));

vi.mock("../db", () => databaseMocks);

import { metalAlertsRouter } from "./metalAlerts";

function createAuthenticatedContext(userId = 42): TrpcContext {
  return {
    user: { id: userId, openId: `user-${userId}`, name: "اختبار AMIC", email: null, loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("metalAlertsRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يقيّد قراءة التنبيهات بمعرّف المستخدم الموثق", async () => {
    databaseMocks.listUserMetalAlerts.mockResolvedValue([]);
    await metalAlertsRouter.createCaller(createAuthenticatedContext(42)).list();
    expect(databaseMocks.listUserMetalAlerts).toHaveBeenCalledWith(42);
  });

  it("يحفظ تنبيه الذهب باسم مالك الحساب نفسه", async () => {
    databaseMocks.createUserMetalAlert.mockResolvedValue({ id: 12 });
    const caller = metalAlertsRouter.createCaller(createAuthenticatedContext(42));
    await caller.create({ metal: "XAUUSD", direction: "above", targetPrice: "2500.50" });
    expect(databaseMocks.createUserMetalAlert).toHaveBeenCalledWith(42, { metal: "XAUUSD", direction: "above", targetPrice: "2500.50" });
  });

  it("يرفض سعر تنبيه غير صالح قبل الوصول إلى قاعدة البيانات", async () => {
    const caller = metalAlertsRouter.createCaller(createAuthenticatedContext(42));
    await expect(caller.create({ metal: "XAGUSD", direction: "below", targetPrice: "صفر" })).rejects.toThrow();
    expect(databaseMocks.createUserMetalAlert).not.toHaveBeenCalled();
  });

  it("لا يلغي التنبيه إلا ضمن نطاق المستخدم الحالي", async () => {
    databaseMocks.cancelUserMetalAlert.mockResolvedValue({ success: true });
    await metalAlertsRouter.createCaller(createAuthenticatedContext(42)).cancel({ id: 7 });
    expect(databaseMocks.cancelUserMetalAlert).toHaveBeenCalledWith(42, 7);
  });
});

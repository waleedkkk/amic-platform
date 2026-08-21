import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const databaseMocks = vi.hoisted(() => ({
  cancelUserStructureAlert: vi.fn(),
  createUserStructureAlert: vi.fn(),
  listUserStructureAlerts: vi.fn(),
}));

vi.mock("../db", () => databaseMocks);

import { structureAlertsRouter } from "./structureAlerts";

function createAuthenticatedContext(userId = 42): TrpcContext {
  return {
    user: { id: userId, openId: `user-${userId}`, name: "اختبار AMIC", email: null, loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("structureAlertsRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يقيّد قائمة تنبيهات البنية بمعرّف المستخدم الموثق", async () => {
    databaseMocks.listUserStructureAlerts.mockResolvedValue([]);
    await structureAlertsRouter.createCaller(createAuthenticatedContext(42)).list();
    expect(databaseMocks.listUserStructureAlerts).toHaveBeenCalledWith(42);
  });

  it("يحفظ قاعدة اختراق باسم مالك الحساب نفسه", async () => {
    databaseMocks.createUserStructureAlert.mockResolvedValue({ id: 8 });
    const input = { symbol: "BTCUSDT", exchange: "BINANCE", interval: "15m" as const, eventType: "breakout" as const };
    await structureAlertsRouter.createCaller(createAuthenticatedContext(42)).create(input);
    expect(databaseMocks.createUserStructureAlert).toHaveBeenCalledWith(42, input);
  });

  it("يرفض نوع حدث غير معروف قبل الوصول إلى قاعدة البيانات", async () => {
    const caller = structureAlertsRouter.createCaller(createAuthenticatedContext(42));
    await expect(caller.create({ symbol: "BTCUSDT", exchange: "BINANCE", interval: "15m", eventType: "unknown" } as never)).rejects.toThrow();
    expect(databaseMocks.createUserStructureAlert).not.toHaveBeenCalled();
  });

  it("لا يلغي التنبيه إلا ضمن نطاق المستخدم الحالي", async () => {
    databaseMocks.cancelUserStructureAlert.mockResolvedValue({ success: true });
    await structureAlertsRouter.createCaller(createAuthenticatedContext(42)).cancel({ id: 7 });
    expect(databaseMocks.cancelUserStructureAlert).toHaveBeenCalledWith(42, 7);
  });
});

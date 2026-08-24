import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const databaseMocks = vi.hoisted(() => ({
  getUserOrderFlowPreferences: vi.fn(),
  saveUserOrderFlowPreferences: vi.fn(),
}));

vi.mock("../db", () => databaseMocks);

import { orderFlowPreferencesRouter } from "./orderFlowPreferences";

function context(userId: number): TrpcContext {
  return {
    user: { id: userId, openId: `user-${userId}`, name: null, email: `user${userId}@example.test`, passwordHash: null, loginMethod: "email", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("orderFlowPreferencesRouter", () => {
  beforeEach(() => vi.clearAllMocks());

  it("يعيد الافتراضيات للحساب الحالي عند غياب تفضيلات محفوظة", async () => {
    databaseMocks.getUserOrderFlowPreferences.mockResolvedValue(undefined);
    const caller = orderFlowPreferencesRouter.createCaller(context(17));
    await expect(caller.getPreferences()).resolves.toEqual({ largeTradeMinNotional: 5_000, depthLevels: 20 });
    expect(databaseMocks.getUserOrderFlowPreferences).toHaveBeenCalledWith(17);
  });

  it("يحفظ التفضيلات ضمن حساب الطالب فقط ويرفض عمقًا غير مسموح", async () => {
    databaseMocks.saveUserOrderFlowPreferences.mockResolvedValue(undefined);
    const caller = orderFlowPreferencesRouter.createCaller(context(17));
    await caller.savePreferences({ largeTradeMinNotional: 25_000, depthLevels: 10 });
    expect(databaseMocks.saveUserOrderFlowPreferences).toHaveBeenCalledWith(17, { largeTradeMinNotional: 25_000, depthLevels: 10 });
    await expect(caller.savePreferences({ largeTradeMinNotional: 25_000, depthLevels: 12 as never })).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });
});

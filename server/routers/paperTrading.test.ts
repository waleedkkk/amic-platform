import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const databaseMocks = vi.hoisted(() => ({
  closeUserPaperTrade: vi.fn(),
  createPaperTrade: vi.fn(),
  listUserPaperTrades: vi.fn(),
}));

vi.mock("../db", () => databaseMocks);

import { paperTradingRouter } from "./paperTrading";

function createAuthenticatedContext(userId = 71): TrpcContext {
  return {
    user: {
      id: userId,
      openId: `user-${userId}`,
      name: "اختبار AMIC",
      email: null,
      loginMethod: "manus",
      role: "user",
      createdAt: new Date(),
      updatedAt: new Date(),
      lastSignedIn: new Date(),
    },
    req: {} as TrpcContext["req"],
    res: {} as TrpcContext["res"],
  };
}

describe("paperTradingRouter", () => {
  it("يقيّد قراءة المراكز بمعرّف المستخدم الموثق", async () => {
    databaseMocks.listUserPaperTrades.mockResolvedValue([]);
    const caller = paperTradingRouter.createCaller(createAuthenticatedContext(71));

    await caller.list();

    expect(databaseMocks.listUserPaperTrades).toHaveBeenCalledWith(71);
  });

  it("يمرّر مالك الحساب نفسه عند إغلاق مركز محدد", async () => {
    databaseMocks.closeUserPaperTrade.mockResolvedValue({ id: 9, realizedPnl: "2.00000000" });
    const caller = paperTradingRouter.createCaller(createAuthenticatedContext(71));

    await caller.close({ id: 9, closePrice: "101.5" });

    expect(databaseMocks.closeUserPaperTrade).toHaveBeenCalledWith(71, 9, "101.5");
  });

  it("يرفض صيغة كمية غير صالحة قبل الوصول إلى قاعدة البيانات", async () => {
    const caller = paperTradingRouter.createCaller(createAuthenticatedContext());

    await expect(caller.open({
      symbol: "BTCUSDT",
      exchange: "BINANCE",
      assetClass: "crypto",
      side: "long",
      quantity: "غير-رقمي",
      entryPrice: "100",
    })).rejects.toThrow();

    expect(databaseMocks.createPaperTrade).not.toHaveBeenCalled();
  });
});

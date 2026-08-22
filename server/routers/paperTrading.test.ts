import { describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const databaseMocks = vi.hoisted(() => ({
  closeUserPaperTrade: vi.fn(),
  createPaperTrade: vi.fn(),
  getUserPaperTradingSummary: vi.fn(),
  listUserPaperTrades: vi.fn(),
  listUserSignals: vi.fn(),
}));

const candleMocks = vi.hoisted(() => ({ getCandleHistoryCached: vi.fn() }));

vi.mock("../db", () => databaseMocks);
vi.mock("../candles", () => candleMocks);

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

  it("يعيد ملخص الأداء للمستخدم الموثق فقط", async () => {
    databaseMocks.getUserPaperTradingSummary.mockResolvedValue({
      totalTrades: 4,
      openTrades: 1,
      closedTrades: 3,
      winningTrades: 2,
      winRate: 66.67,
      realizedPnl: "12.50000000",
    });
    const caller = paperTradingRouter.createCaller(createAuthenticatedContext(71));

    await expect(caller.summary()).resolves.toMatchObject({ totalTrades: 4, winRate: 66.67 });
    expect(databaseMocks.getUserPaperTradingSummary).toHaveBeenCalledWith(71);
  });

  it("يقيّم الإشارات المحفوظة للمستخدم الموثق فقط", async () => {
    databaseMocks.listUserSignals.mockResolvedValue([{ id: 10, symbol: "BTCUSDT", exchange: "BINANCE", recommendation: "buy", createdAt: new Date(1_699_999_000 * 1_000) }]);
    candleMocks.getCandleHistoryCached.mockResolvedValue({ candles: [{ time: 1_700_000_000, open: 100, high: 101, low: 99, close: 100, volume: 1 }, { time: 1_700_086_400, open: 100, high: 112, low: 99, close: 110, volume: 1 }] });
    const caller = paperTradingRouter.createCaller(createAuthenticatedContext(71));

    await expect(caller.signalPerformance()).resolves.toMatchObject({ trackedSignals: 1, successfulSignals: 1, winRate: 100 });
    expect(databaseMocks.listUserSignals).toHaveBeenCalledWith(71);
  });
});

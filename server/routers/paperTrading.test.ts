import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "../_core/context";

const databaseMocks = vi.hoisted(() => ({
  closeUserPaperTrade: vi.fn(),
  createPaperTrade: vi.fn(),
  getUserClosedPaperTrade: vi.fn(),
  getUserPaperTradingSummary: vi.fn(),
  getUserSignal: vi.fn(),
  getUserPaperTradeCritique: vi.fn(),
  listUserPaperTrades: vi.fn(),
  listUserSignals: vi.fn(),
  saveUserPaperTradeCritique: vi.fn(),
}));

const candleMocks = vi.hoisted(() => ({ getCandleHistoryCached: vi.fn() }));
const critiqueMocks = vi.hoisted(() => ({ generatePaperTradeCritique: vi.fn() }));

vi.mock("../db", () => databaseMocks);
vi.mock("../candles", () => candleMocks);
vi.mock("../tradeCritique", () => critiqueMocks);

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
  beforeEach(() => vi.clearAllMocks());

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

    expect(databaseMocks.closeUserPaperTrade).toHaveBeenCalledWith(71, 9, "101.5", { confirmPriceDeviation: false });
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

  it("يمرر signalId اختياريًا عند فتح صفقة من مسودة مرتبطة", async () => {
    databaseMocks.createPaperTrade.mockResolvedValue({ id: 17 });
    const caller = paperTradingRouter.createCaller(createAuthenticatedContext(71));

    await caller.open({ symbol: "BTCUSDT", exchange: "BINANCE", assetClass: "crypto", side: "long", quantity: "1", entryPrice: "100", signalId: 41 });

    expect(databaseMocks.createPaperTrade).toHaveBeenCalledWith(71, expect.objectContaining({ signalId: 41 }));
  });

  it("يجلب السعر المرجعي للمراكز المفتوحة ويزيل الأصول المكررة", async () => {
    databaseMocks.listUserPaperTrades.mockResolvedValue([
      { id: 1, status: "open", symbol: "BTCUSDT", exchange: "BINANCE" },
      { id: 2, status: "open", symbol: "btcusdt", exchange: "binance" },
      { id: 3, status: "closed", symbol: "ETHUSDT", exchange: "BINANCE" },
    ]);
    candleMocks.getCandleHistoryCached.mockResolvedValue({ provider: "yahoo", fetchedAt: "2026-08-25T10:00:00.000Z", regularMarketPrice: 100, candles: [{ time: 1, close: 99 }] });
    const caller = paperTradingRouter.createCaller(createAuthenticatedContext(71));

    await expect(caller.referencePrices()).resolves.toEqual([{ symbol: "BTCUSDT", exchange: "BINANCE", reference: { provider: "yahoo", fetchedAt: "2026-08-25T10:00:00.000Z", price: "100.00000000", candleTime: 1 } }]);
    expect(databaseMocks.listUserPaperTrades).toHaveBeenCalledWith(71);
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

  it("يستخدم الإشارة الصريحة حتى مع وجود إشارة أحدث للرمز والبورصة نفسيهما", async () => {
    databaseMocks.getUserClosedPaperTrade.mockResolvedValue({ id: 9, userId: 71, signalId: 41, symbol: "BTCUSDT", exchange: "BINANCE", side: "long", quantity: "1", entryPrice: "100", exitPrice: "110", stopLoss: "95", takeProfit: "115", realizedPnl: "10", openedAt: new Date("2026-08-24T12:00:00.000Z"), closedAt: new Date("2026-08-24T13:00:00.000Z") });
    databaseMocks.getUserSignal.mockResolvedValue({ id: 41, symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h", recommendation: "buy", confidence: 70, summary: "الإشارة المؤكدة", createdAt: new Date("2026-08-24T11:59:00.000Z") });
    databaseMocks.listUserSignals.mockResolvedValue([{ id: 42, symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h", recommendation: "sell", confidence: 80, summary: "إشارة أحدث", createdAt: new Date("2026-08-24T12:01:00.000Z") }]);
    critiqueMocks.generatePaperTradeCritique.mockResolvedValue({ disclaimer: "تعليمي فقط؛ لا يمثل توصية تداول." });
    databaseMocks.saveUserPaperTradeCritique.mockResolvedValue({ paperTradeId: 9, content: { disclaimer: "تعليمي فقط؛ لا يمثل توصية تداول." } });
    const caller = paperTradingRouter.createCaller(createAuthenticatedContext(71));

    await caller.critique.generate({ tradeId: 9 });

    expect(databaseMocks.getUserSignal).toHaveBeenCalledWith(71, 41);
    expect(databaseMocks.listUserSignals).not.toHaveBeenCalled();
    expect(critiqueMocks.generatePaperTradeCritique).toHaveBeenCalledWith(expect.objectContaining({ linkType: "confirmed", signal: expect.objectContaining({ summary: "الإشارة المؤكدة" }) }));
  });

  it("يبقي الصفقات القديمة دون signalId عاملة عبر التخمين السابق الأقرب فقط", async () => {
    databaseMocks.getUserClosedPaperTrade.mockResolvedValue({ id: 10, userId: 71, signalId: null, symbol: "BTCUSDT", exchange: "BINANCE", side: "long", quantity: "1", entryPrice: "100", exitPrice: "110", stopLoss: "95", takeProfit: "115", realizedPnl: "10", openedAt: new Date("2026-08-24T12:00:00.000Z"), closedAt: new Date("2026-08-24T13:00:00.000Z") });
    databaseMocks.listUserSignals.mockResolvedValue([
      { id: 1, symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h", recommendation: "buy", confidence: 70, summary: "إشارة سابقة بعيدة", createdAt: new Date("2026-08-24T10:00:00.000Z") },
      { id: 2, symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h", recommendation: "buy", confidence: 70, summary: "إشارة سابقة قريبة", createdAt: new Date("2026-08-24T11:58:00.000Z") },
      { id: 3, symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h", recommendation: "sell", confidence: 70, summary: "إشارة لاحقة", createdAt: new Date("2026-08-24T12:01:00.000Z") },
    ]);
    critiqueMocks.generatePaperTradeCritique.mockResolvedValue({ disclaimer: "تعليمي فقط؛ لا يمثل توصية تداول." });
    databaseMocks.saveUserPaperTradeCritique.mockResolvedValue({ paperTradeId: 10, content: { disclaimer: "تعليمي فقط؛ لا يمثل توصية تداول." } });
    const caller = paperTradingRouter.createCaller(createAuthenticatedContext(71));

    await caller.critique.generate({ tradeId: 10 });

    expect(databaseMocks.getUserSignal).not.toHaveBeenCalled();
    expect(critiqueMocks.generatePaperTradeCritique).toHaveBeenCalledWith(expect.objectContaining({ linkType: "guessed", signal: expect.objectContaining({ summary: "إشارة سابقة قريبة" }) }));
  });
});

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const databaseMocks = vi.hoisted(() => ({
  select: vi.fn(),
  update: vi.fn(),
}));
const candleMocks = vi.hoisted(() => ({ getCandleHistoryCached: vi.fn() }));

vi.mock("drizzle-orm/mysql2", () => ({ drizzle: vi.fn(() => databaseMocks) }));
vi.mock("./candles", () => candleMocks);

process.env.DATABASE_URL = "mysql://test:test@localhost/test";
const { closeUserPaperTrade } = await import("./db");

const trade = {
  id: 9,
  userId: 71,
  signalId: null,
  symbol: "BTCUSDT",
  exchange: "BINANCE",
  assetClass: "crypto" as const,
  side: "long" as const,
  status: "open" as const,
  quantity: "1.00000000",
  entryPrice: "90.00000000",
  exitPrice: null,
  stopLoss: "85.00000000",
  takeProfit: "110.00000000",
  referencePriceAtClose: null,
  priceDeviationPercent: null,
  priceDeviationWarning: 0,
  realizedPnl: null,
  note: null,
  openedAt: new Date("2026-08-25T09:00:00.000Z"),
  closedAt: null,
  createdAt: new Date("2026-08-25T09:00:00.000Z"),
  updatedAt: new Date("2026-08-25T09:00:00.000Z"),
};

function prepareDatabase() {
  const limit = vi.fn().mockResolvedValue([trade]);
  const whereSelect = vi.fn().mockReturnValue({ limit });
  const from = vi.fn().mockReturnValue({ where: whereSelect });
  databaseMocks.select.mockReturnValue({ from });

  const whereUpdate = vi.fn().mockResolvedValue(undefined);
  const set = vi.fn().mockReturnValue({ where: whereUpdate });
  databaseMocks.update.mockReturnValue({ set });
  return { set, whereUpdate };
}

describe("closeUserPaperTrade reference validation", () => {
  beforeEach(() => {
    prepareDatabase();
    candleMocks.getCandleHistoryCached.mockResolvedValue({
      provider: "twelve-data",
      fetchedAt: "2026-08-25T10:00:00.000Z",
      regularMarketPrice: 100,
      candles: [{ time: 1, open: 99, high: 101, low: 98, close: 100, volume: 10 }],
    });
  });

  afterEach(() => vi.clearAllMocks());

  it("يغلق السعر القريب دون تحذير ويحفظ النسبة المرجعية", async () => {
    const result = await closeUserPaperTrade(71, 9, "104");

    expect(result).toMatchObject({ closed: true, requiresConfirmation: false, priceDeviationWarning: false, priceDeviationPercent: 4, referencePrice: "100.00000000" });
    expect(databaseMocks.update).toHaveBeenCalledTimes(1);
  });

  it("يعيد طلب تأكيد ولا ينفذ التحديث عند تجاوز العتبة", async () => {
    const result = await closeUserPaperTrade(71, 9, "110");

    expect(result).toMatchObject({ closed: false, requiresConfirmation: true, priceDeviationWarning: true, priceDeviationPercent: 10, referencePrice: "100.00000000" });
    expect(databaseMocks.update).not.toHaveBeenCalled();
  });

  it("ينفذ الإغلاق بعد التأكيد الصريح ويحفظ علم الانحراف", async () => {
    const { set } = prepareDatabase();
    const result = await closeUserPaperTrade(71, 9, "110", { confirmPriceDeviation: true });

    expect(result).toMatchObject({ closed: true, requiresConfirmation: false, priceDeviationWarning: true, priceDeviationPercent: 10 });
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ priceDeviationWarning: 1, priceDeviationPercent: "10.0000", referencePriceAtClose: "100.00000000" }));
  });

  it("يكمل الإغلاق دون تحذير عند غياب السعر المرجعي", async () => {
    candleMocks.getCandleHistoryCached.mockRejectedValue(new Error("provider unavailable"));

    const result = await closeUserPaperTrade(71, 9, "110");

    expect(result).toMatchObject({ closed: true, requiresConfirmation: false, priceDeviationWarning: false, priceDeviationPercent: null, referencePrice: null });
    expect(databaseMocks.update).toHaveBeenCalledTimes(1);
  });
});

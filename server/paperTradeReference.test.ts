import { afterEach, describe, expect, it, vi } from "vitest";

const candleMocks = vi.hoisted(() => ({ getCandleHistoryCached: vi.fn() }));
vi.mock("./candles", () => candleMocks);

const { calculatePriceDeviationPercent, getPaperTradeReferencePrice } = await import("./paperTradeReference");

describe("paper trade reference price", () => {
  afterEach(() => vi.clearAllMocks());

  it("يحسب نسبة الانحراف المطلقة بدقة", () => {
    expect(calculatePriceDeviationPercent("110", "100")).toBe(10);
    expect(calculatePriceDeviationPercent("95", "100")).toBe(5);
    expect(calculatePriceDeviationPercent("104.7619", "100")).toBe(4.7619);
  });

  it("يستخدم السعر المرجعي الحي المتاح في تاريخ الشموع", async () => {
    candleMocks.getCandleHistoryCached.mockResolvedValue({
      provider: "twelve-data",
      fetchedAt: "2026-08-25T10:00:00.000Z",
      regularMarketPrice: 101.25,
      candles: [{ time: 1, open: 100, high: 102, low: 99, close: 100.5, volume: 10 }],
    });

    await expect(getPaperTradeReferencePrice("BTCUSDT", "BINANCE")).resolves.toEqual({
      price: "101.25000000",
      provider: "twelve-data",
      fetchedAt: "2026-08-25T10:00:00.000Z",
      candleTime: 1,
    });
  });

  it("يعود بقيمة null عند فشل جميع مصادر السعر", async () => {
    candleMocks.getCandleHistoryCached.mockRejectedValue(new Error("provider unavailable"));

    await expect(getPaperTradeReferencePrice("BTCUSDT", "BINANCE")).resolves.toBeNull();
  });
});

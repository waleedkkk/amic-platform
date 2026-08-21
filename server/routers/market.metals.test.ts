import { describe, expect, it } from "vitest";
import { toPreciousMetalQuote } from "./market";

describe("toPreciousMetalQuote", () => {
  it("يحسب تغير الذهب من السعر الحالي مقارنة بإغلاق الشمعة السابقة", () => {
    const quote = toPreciousMetalQuote(
      { symbol: "XAUUSD", label: "الذهب", shortLabel: "XAU", precision: 2 },
      {
        symbol: "XAUUSD", yahooSymbol: "XAUUSD=X", interval: "1d", currency: "USD", exchangeName: "CCY",
        regularMarketPrice: 2400,
        fetchedAt: "2026-08-21T00:00:00.000Z",
        candles: [
          { time: 1, open: 2360, high: 2370, low: 2350, close: 2360, volume: 0 },
          { time: 2, open: 2380, high: 2410, low: 2370, close: 2390, volume: 0 },
        ],
      },
    );

    expect(quote).toMatchObject({ symbol: "XAUUSD", label: "الذهب", price: 2400, currency: "USD", precision: 2 });
    expect(quote.changePercent).toBeCloseTo((2400 - 2360) / 2360 * 100, 8);
  });

  it("لا يخترع تغيرًا عندما لا تتوفر شمعة سابقة", () => {
    const quote = toPreciousMetalQuote(
      { symbol: "XAGUSD", label: "الفضة", shortLabel: "XAG", precision: 3 },
      {
        symbol: "XAGUSD", yahooSymbol: "XAGUSD=X", interval: "1d", currency: "USD", exchangeName: "CCY",
        regularMarketPrice: null,
        fetchedAt: "2026-08-21T00:00:00.000Z",
        candles: [{ time: 1, open: 28, high: 29, low: 27, close: 28.5, volume: 0 }],
      },
    );

    expect(quote.price).toBe(28.5);
    expect(quote.changePercent).toBeNull();
  });

  it("يُعيد نقاطًا ساعية حقيقية للمخطط المصغر وينهيها بالسعر المعروض", () => {
    const quote = toPreciousMetalQuote(
      { symbol: "XAUUSD", label: "الذهب", shortLabel: "XAU", precision: 2 },
      {
        symbol: "GC=F", yahooSymbol: "GC=F", interval: "1d", currency: "USD", exchangeName: "CMX",
        regularMarketPrice: 2410,
        fetchedAt: "2026-08-21T00:00:00.000Z",
        candles: [
          { time: 1, open: 2380, high: 2390, low: 2375, close: 2385, volume: 0 },
          { time: 2, open: 2390, high: 2415, low: 2385, close: 2400, volume: 0 },
        ],
      },
      {
        symbol: "GC=F", yahooSymbol: "GC=F", interval: "60m", currency: "USD", exchangeName: "CMX",
        regularMarketPrice: 2408,
        fetchedAt: "2026-08-21T00:00:00.000Z",
        candles: [
          { time: 1, open: 2390, high: 2394, low: 2389, close: 2392, volume: 10 },
          { time: 2, open: 2392, high: 2401, low: 2391, close: 2398, volume: 20 },
          { time: 3, open: 2398, high: 2409, low: 2397, close: 2408, volume: 30 },
        ],
      },
    );

    expect(quote.sparklinePrices).toEqual([2392, 2398, 2410]);
    expect(quote.sparklineRange).toBe("day");
  });

  it("يقتصر مخطط الأسبوع على آخر سبع إغلاقات يومية وينهيه بالسعر الحالي", () => {
    const candles = Array.from({ length: 10 }, (_, index) => ({ time: index + 1, open: 2300 + index, high: 2310 + index, low: 2290 + index, close: 2300 + index, volume: 1 }));
    const quote = toPreciousMetalQuote(
      { symbol: "XAUUSD", label: "الذهب", shortLabel: "XAU", precision: 2 },
      { symbol: "GC=F", yahooSymbol: "GC=F", interval: "1d", currency: "USD", exchangeName: "CMX", regularMarketPrice: 2410, fetchedAt: "2026-08-21T00:00:00.000Z", candles: candles.slice(-2) },
      { symbol: "GC=F", yahooSymbol: "GC=F", interval: "1d", currency: "USD", exchangeName: "CMX", regularMarketPrice: 2409, fetchedAt: "2026-08-21T00:00:00.000Z", candles },
      "week",
    );

    expect(quote.sparklinePrices).toEqual([2303, 2304, 2305, 2306, 2307, 2308, 2410]);
    expect(quote.sparklineRange).toBe("week");
  });
});

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
});

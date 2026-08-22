import { describe, expect, it } from "vitest";
import { assessSignalFollowThrough, summarizeSignalFollowThrough } from "./signalPerformance";

const candles = [
  { time: 1_700_000_000, open: 100, high: 103, low: 99, close: 100, volume: 1 },
  { time: 1_700_086_400, open: 100, high: 112, low: 99, close: 110, volume: 1 },
];

describe("signal follow-through", () => {
  it("يعد إشارة الشراء ناجحة عند تحرك السعر لاحقًا في اتجاهها", () => {
    const result = assessSignalFollowThrough({ id: 1, symbol: "XAUUSD", exchange: "FX", recommendation: "buy", createdAt: new Date(1_699_999_000 * 1_000) }, candles);
    expect(result).toMatchObject({ status: "successful", entryPrice: 100, latestPrice: 110, changePercent: 10 });
  });

  it("يحسب ملخصًا من النتائج المقيسة فقط ولا يعامل الحيادية كنجاح", () => {
    const summary = summarizeSignalFollowThrough([
      { id: 1, symbol: "A", exchange: "FX", recommendation: "buy", status: "successful", entryPrice: 1, latestPrice: 2, changePercent: 100 },
      { id: 2, symbol: "B", exchange: "FX", recommendation: "sell", status: "unfavorable", entryPrice: 2, latestPrice: 3, changePercent: 50 },
      { id: 3, symbol: "C", exchange: "FX", recommendation: "neutral", status: "neutral", entryPrice: null, latestPrice: null, changePercent: null },
    ]);
    expect(summary).toMatchObject({ measuredSignals: 2, successfulSignals: 1, winRate: 50 });
  });
});

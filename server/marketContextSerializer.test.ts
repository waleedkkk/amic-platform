import { describe, expect, it } from "vitest";
import { truncateMarketContext } from "./marketContextSerializer";

describe("truncateMarketContext", () => {
  it("يعيد JSON صالحًا ويحافظ على السعر والاتجاه عند تجاوز السياق الحد بعدة أضعاف", () => {
    const context = {
      currentPrice: 76801.25,
      trend: "bullish",
      symbol: "BTCUSDT",
      news: Array.from({ length: 80 }, (_, index) => ({ title: `خبر تفصيلي ${index}`, body: "محتوى طويل ".repeat(80) })),
      historicalCandles: Array.from({ length: 500 }, (_, index) => ({ time: index, open: index, high: index + 2, low: index - 1, close: index + 1 })),
      metadata: { provider: "TradingView", rawPayload: "x".repeat(25_000) },
    };

    const serialized = truncateMarketContext(context, 700);
    const parsed = JSON.parse(serialized) as Record<string, unknown>;

    expect(serialized.length).toBeLessThanOrEqual(700);
    expect(parsed.currentPrice).toBe(76801.25);
    expect(parsed.trend).toBe("bullish");
    expect(parsed.symbol).toBe("BTCUSDT");
    expect(parsed.news).toBeUndefined();
  });

  it("يعيد التسلسل الأصلي من دون تعديل عندما يقع ضمن الحد", () => {
    const context = { currentPrice: 100, trend: "neutral", exchange: "BINANCE" };
    expect(truncateMarketContext(context, 200)).toBe(JSON.stringify(context));
  });
});

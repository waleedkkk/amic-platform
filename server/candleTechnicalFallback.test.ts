import { describe, expect, it } from "vitest";
import { deriveTechnicalAnalysisFromCandles } from "./candleTechnicalFallback";

function candle(index: number) {
  const close = 100 + index * 0.5;
  return { time: 1_700_000_000 + index * 3_600, open: close - 0.2, high: close + 0.8, low: close - 0.7, close, volume: 100 + index };
}

describe("candle technical fallback", () => {
  it("يبني عقدًا موحدًا من تاريخ الشموع ويُبقي التوصية محايدة", () => {
    const analysis = deriveTechnicalAnalysisFromCandles({
      symbol: "BTCUSDT",
      yahooSymbol: "BTC-USD",
      provider: "yahoo",
      sourceRole: "fallback",
      interval: "60m",
      candles: Array.from({ length: 250 }, (_, index) => candle(index)),
      currency: "USD",
      exchangeName: "BINANCE",
      regularMarketPrice: 225,
      fetchedAt: "2026-08-24T10:00:00.000Z",
    }, { symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h" });

    expect(analysis.source).toBe("candle-history");
    expect(analysis.recommendation.signal).toBe("neutral");
    expect(analysis.price.current).toBe(225);
    expect(analysis.indicators.rsi.value).not.toBeNull();
    expect(analysis.indicators.macd.line).not.toBeNull();
    expect(analysis.indicators.bollinger.middle).not.toBeNull();
    expect(analysis.indicators.atr.value).not.toBeNull();
    expect(analysis.indicators.movingAverages.ema.ema200).not.toBeNull();
  });
});

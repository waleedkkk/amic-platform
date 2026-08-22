import { describe, expect, it } from "vitest";
import { normalizeMultiTimeframeAnalysis, normalizeTechnicalAnalysis } from "./technicalAnalysis";

describe("تطبيع التحليل الفني", () => {
  it("يعزل الواجهة عن الاسم الخام bollinger_bands ويعيد عقدًا ثابتًا", () => {
    const result = normalizeTechnicalAnalysis({
      symbol: "BINANCE:BTCUSDT",
      exchange: "binance",
      timeframe: "1h",
      timestamp: "real-time",
      price_data: { current_price: 77_298.84, close: 77_298.84, change_percent: 0.014 },
      rsi: { value: 53.57, signal: "Neutral", direction: "Rising", previous: 53.42 },
      macd: { macd_line: 175.88, signal_line: 340.44, histogram: -164.56, crossover: "Bearish" },
      bollinger_bands: { upper: 78_672.32, middle: 77_581.26, lower: 76_490.19, width: 0.0281, squeeze: false },
      support_resistance: { nearest_support: 61_826.44, support_1: 61_826.44, resistance_1: 64_682.34 },
      market_sentiment: { buy_sell_signal: "NEUTRAL" },
    }, { symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h" }, "2026-08-22T12:00:00.000Z");

    expect(result).toMatchObject({
      schemaVersion: 1,
      source: "tradingview-mcp",
      price: { current: 77_298.84, close: 77_298.84, changePercent: 0.014 },
      recommendation: { signal: "neutral" },
      indicators: {
        rsi: { value: 53.57 },
        macd: { line: 175.88, signal: 340.44, histogram: -164.56, crossover: "Bearish" },
        bollinger: { upper: 78_672.32, middle: 77_581.26, lower: 76_490.19, width: 0.0281, squeeze: false },
      },
      levels: { supports: [61_826.44], resistances: [64_682.34], nearestSupport: 61_826.44 },
    });
  });

  it("يتعامل مع الصيغة البديلة ذات الحروف الكبيرة وCamelCase دون تغيير العقد", () => {
    const result = normalizeTechnicalAnalysis({
      priceData: { currentPrice: "125.5" },
      relativeStrengthIndex: { current: "61.4" },
      macd: { macdLine: "2.5", signalLine: "1.5" },
      bollingerBands: { upperBand: "130", middleBand: "125", lowerBand: "120" },
      marketSentiment: { buySellSignal: "STRONG BUY" },
    }, { symbol: "ALT", exchange: "TEST", timeframe: "4h" });

    expect(result.price.current).toBe(125.5);
    expect(result.indicators.rsi.value).toBe(61.4);
    expect(result.indicators.macd).toMatchObject({ line: 2.5, signal: 1.5 });
    expect(result.indicators.bollinger).toMatchObject({ upper: 130, middle: 125, lower: 120 });
    expect(result.recommendation.signal).toBe("strong_buy");
  });
});

describe("تطبيع التحليل متعدد الأطر", () => {
  it("ينشئ قراءات أطر ثابتة وملخص توافق موحد", () => {
    const result = normalizeMultiTimeframeAnalysis({
      symbol: "BINANCE:BTCUSDT",
      exchange: "binance",
      timeframes: {
        "1h": { label: "Entry Timing", bias: "Bullish", price: 77_000, rsi: { value: 54 }, macd_crossover: "Bearish", ema_trend: { ema20: 76_900, ema50: 76_500, ema200: 70_000 } },
      },
      alignment: { status: "LEAN BULLISH", confidence: "Medium", net_score: 2, scores_by_tf: { "1h": 1 } },
      recommendation: { action: "CAUTIOUS BUY", entry_timeframe: "1H", rules: ["Wait for confirmation"] },
    }, { symbol: "BTCUSDT", exchange: "BINANCE" }, "2026-08-22T12:00:00.000Z");

    expect(result).toMatchObject({
      schemaVersion: 1,
      alignment: { status: "LEAN BULLISH", netScore: 2 },
      recommendation: { signal: "buy", entryTimeframe: "1H", rules: ["Wait for confirmation"] },
      frames: { "1h": { bias: "Bullish", score: 1, rsi: 54, ema: { ema20: 76_900 } } },
    });
  });
});

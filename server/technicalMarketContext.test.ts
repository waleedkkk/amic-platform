import { describe, expect, it } from "vitest";
import { measureAtr, summarizeTimeframeAlignment } from "../shared/technicalMarketContext";

describe("سياق التوافق وقياس ATR", () => {
  it("يقيس تذبذب الفوركس بواحدة pips وتذبذب المعادن بالنقاط السعرية", () => {
    expect(measureAtr("EURUSD", "FX", 0.008, 1.1)).toMatchObject({ value: 80, unit: "pips", digits: 1 });
    expect(measureAtr("USDJPY", "FX", 0.8, 155)).toMatchObject({ value: 80, unit: "pips" });
    expect(measureAtr("XAUUSD", "FX", 20.5, 4000)).toMatchObject({ value: 2050, unit: "نقطة سعرية", digits: 0 });
    expect(measureAtr("XAGUSD", "FX", 1.25, 60)).toMatchObject({ value: 1250, unit: "نقطة سعرية" });
  });

  it("يلخص اتفاق الاتجاهات ويظهر الأطر المتباينة", () => {
    const summary = summarizeTimeframeAlignment({
      frames: {
        "15m": { timeframe: "15m", label: null, bias: "BUY", score: 2, price: null, changePercent: null, rsi: 55, macdCrossover: null, ema: { ema20: null, ema50: null, ema200: null }, marketStructure: "bullish", trendStrength: null, momentumAligned: true, advice: null, keyIndicators: [] },
        "1h": { timeframe: "1h", label: null, bias: "BULLISH", score: 3, price: null, changePercent: null, rsi: 60, macdCrossover: null, ema: { ema20: null, ema50: null, ema200: null }, marketStructure: "bullish", trendStrength: null, momentumAligned: true, advice: null, keyIndicators: [] },
        "4h": { timeframe: "4h", label: null, bias: "SELL", score: -1, price: null, changePercent: null, rsi: 42, macdCrossover: null, ema: { ema20: null, ema50: null, ema200: null }, marketStructure: "bearish", trendStrength: null, momentumAligned: false, advice: null, keyIndicators: [] },
      },
      alignment: { status: "mixed", confidence: "medium", netScore: 4, divergentTimeframes: ["4h"] },
      schemaVersion: 1,
      source: "tradingview-mcp",
      fetchedAt: "2026-08-23T00:00:00.000Z",
      symbol: "XAUUSD",
      exchange: "FX",
      recommendation: { signal: "buy", summary: null, entryTimeframe: null, rules: [] },
      levels: { supports: [], resistances: [] },
    });

    expect(summary).toMatchObject({ dominantDirection: "bullish", agreementPercent: 67, bullish: 2, bearish: 1, divergentTimeframes: ["4h"] });
  });
});

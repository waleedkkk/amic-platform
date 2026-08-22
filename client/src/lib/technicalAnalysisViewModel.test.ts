import { describe, expect, it } from "vitest";
import type { MultiTimeframeAnalysis, TechnicalAnalysis } from "@shared/technicalAnalysis";
import { createSavedAnalysisPayload, describeConfluenceFrame, getConfluenceReferencePrice, getTechnicalDetailGroups, getTechnicalMetricCards, getUnavailableMetricLabels } from "./technicalAnalysisViewModel";

const analysis: TechnicalAnalysis = {
  schemaVersion: 1, source: "tradingview-mcp", fetchedAt: "2026-08-22T00:00:00.000Z", sourceTimestamp: null, symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h",
  price: { current: 77_000, open: 76_500, high: 77_500, low: 76_000, close: 77_000, changePercent: 0.5, volume: 100 },
  recommendation: { signal: "buy", confidence: 72 },
  indicators: {
    rsi: { value: 54, signal: "neutral", direction: "rising", previous: 52 },
    macd: { line: 12, signal: 8, histogram: 4, crossover: "bullish" },
    bollinger: { upper: 78_000, middle: 77_000, lower: 76_000, width: 0.02, squeeze: false, position: "middle" },
    atr: { value: 450, percentOfPrice: 0.6, volatility: "medium" },
    stochastic: { k: 64, d: 59, signal: "bullish" },
    adx: { value: 25, trendStrength: "moderate", plusDi: 22, minusDi: 18, signal: "bullish" },
    movingAverages: { sma: { sma20: 76_900 }, ema: { ema20: 76_950 } },
  },
  levels: { pivot: 76_800, supports: [76_000], resistances: [78_000], nearestSupport: 76_000, nearestResistance: 78_000 },
  marketStructure: { trend: "bullish", strength: "moderate", momentumAligned: true },
};

const multi: MultiTimeframeAnalysis = {
  schemaVersion: 1, source: "tradingview-mcp", fetchedAt: "2026-08-22T00:00:00.000Z", symbol: "BTCUSDT", exchange: "BINANCE",
  frames: {
    "1h": { timeframe: "1h", label: "entry", bias: "bullish", score: 0.6, price: 77_000, changePercent: 0.5, rsi: 54, macdCrossover: "bullish", ema: { ema20: 76_900, ema50: 76_500, ema200: 70_000 }, marketStructure: "bullish", trendStrength: "moderate", momentumAligned: true, advice: "wait", keyIndicators: ["RSI"] },
    "4h": { timeframe: "4h", label: null, bias: "bullish", score: 0.2, price: 76_800, changePercent: null, rsi: null, macdCrossover: null, ema: { ema20: null, ema50: null, ema200: null }, marketStructure: null, trendStrength: null, momentumAligned: null, advice: null, keyIndicators: [] },
  },
  alignment: { status: "lean bullish", confidence: "medium", netScore: 2, divergentTimeframes: [] },
  recommendation: { signal: "buy", summary: "buy", entryTimeframe: "1h", rules: [] },
  levels: { supports: [76_000], resistances: [78_000] },
};

describe("نموذج عرض عقد التحليل المعياري", () => {
  it("يبني بطاقات ثابتة وتفاصيل نطاقات Bollinger دون مفاتيح مزود خام", () => {
    expect(getTechnicalMetricCards(analysis).find(item => item.id === "bollinger")?.value).toBe(77_000);
    expect(getUnavailableMetricLabels(analysis)).toEqual([]);
    expect(getTechnicalDetailGroups(analysis).find(group => group.id === "bollinger")?.items[0]).toMatchObject({ label: "العلوي", value: 78_000 });
    expect(getTechnicalDetailGroups(analysis).find(group => group.id === "levels")?.items).toEqual(expect.arrayContaining([
      expect.objectContaining({ label: "Pivot", value: 76_800 }),
      expect.objectContaining({ label: "أقرب دعم", value: 76_000 }),
      expect.objectContaining({ label: "أقرب مقاومة", value: 78_000 }),
      expect.objectContaining({ label: "الدعوم", value: expect.stringContaining("76") }),
    ]));
  });

  it("يصف الإطار ويختار سعرًا مرجعيًا من العقد عند الحاجة", () => {
    expect(describeConfluenceFrame(multi.frames["1h"])).toBe("صاعد (+0.60)");
    expect(getConfluenceReferencePrice(multi)).toEqual({ price: 77_000, timeframe: "1h" });
    expect(getConfluenceReferencePrice({ ...multi, frames: { ...multi.frames, "1h": { ...multi.frames["1h"]!, price: null } } })).toEqual({ price: 76_800, timeframe: "4h" });
  });

  it("يغلف العقد عند حفظ الإشارة مع فصل سياق المخطط عن بيانات المزود", () => {
    expect(createSavedAnalysisPayload(analysis, { kind: "golden" })).toMatchObject({
      contractVersion: 1,
      technicalAnalysis: { symbol: "BTCUSDT", indicators: { bollinger: { middle: 77_000 } } },
      chartContext: { movingAverageCrossover: { kind: "golden" } },
    });
  });
});

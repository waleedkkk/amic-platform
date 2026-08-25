import { describe, expect, it } from "vitest";
import type { ChartIndicatorResult } from "./confluenceIct";
import type { TechnicalAnalysis, TechnicalSignal } from "./technicalAnalysis";
import { calculateUnifiedDecision } from "./unifiedDecision";

const FETCHED_AT = "2026-08-25T12:00:00.000Z";
const NOW = Date.parse("2026-08-25T12:01:00.000Z");

function makeCore(signal: TechnicalSignal, source: TechnicalAnalysis["source"] = "tradingview-mcp"): TechnicalAnalysis {
  return {
    schemaVersion: 1,
    source,
    fetchedAt: FETCHED_AT,
    sourceTimestamp: FETCHED_AT,
    symbol: "BTCUSDT",
    exchange: "BINANCE",
    timeframe: "1h",
    price: { current: 100, open: 99, high: 101, low: 98, close: 100, changePercent: 1, volume: 1000 },
    recommendation: { signal, confidence: signal === "neutral" ? 0 : 80 },
    indicators: {
      rsi: { value: 60, signal: "buy", direction: "bullish", previous: 55 },
      macd: { line: 1, signal: 0.5, histogram: 0.5, crossover: "bullish" },
      bollinger: { upper: 105, middle: 100, lower: 95, width: 10, squeeze: false, position: "middle" },
      atr: { value: 2, percentOfPrice: 2, volatility: "normal" },
      stochastic: { k: 60, d: 55, signal: "buy" },
      adx: { value: 30, trendStrength: "strong", plusDi: 25, minusDi: 15, signal: "buy" },
      movingAverages: { sma: { "20": 99 }, ema: { "20": 99, "50": 98 } },
    },
    levels: { pivot: 100, supports: [95], resistances: [105], nearestSupport: 95, nearestResistance: 105 },
    marketStructure: { trend: "bullish", strength: "strong", momentumAligned: true },
  };
}

function makeIct(
  signal: "BUY" | "SELL" | "WAIT",
  options: { blockedByIct?: "BUY" | "SELL" | null; bull?: number; bear?: number } = {},
): ChartIndicatorResult {
  const blockedByIct = options.blockedByIct ?? null;
  const bull = options.bull ?? (signal === "BUY" ? 8 : 2);
  const bear = options.bear ?? (signal === "SELL" ? 8 : 2);
  return {
    id: "confluence-ict-v3-4",
    lines: [],
    zones: [],
    levels: [],
    events: [],
    signals: [],
    breakdown: [],
    summary: {
      mode: "normal",
      preset: "balanced",
      trend: signal === "BUY" ? "bullish" : signal === "SELL" ? "bearish" : "neutral",
      confluence: { bull, bear, net: bull - bear, max: 11 },
      ict: {
        bull,
        bear,
        max: 11,
        confirmation: {
          enabled: true,
          threshold: 5,
          bullConfirmed: blockedByIct !== "BUY",
          bearConfirmed: blockedByIct !== "SELL",
        },
      },
      scalp: { bull: 0, bear: 0, threshold: 0, max: 0 },
      signal,
      decision: { baseSignal: signal === "WAIT" ? "BUY" : signal, blockedByIct },
      reasons: [],
    },
  };
}

describe("calculateUnifiedDecision", () => {
  it("يُصنّف توافق القراءة الأساسية وICT كاتفاق صاعد", () => {
    const result = calculateUnifiedDecision({ core: makeCore("strong_buy"), ict: makeIct("BUY"), nowMs: NOW });

    expect(result.state).toBe("aligned_bullish");
    expect(result.direction).toBe("bullish");
    expect(result.evidenceScore).toBeGreaterThan(50);
    expect(result.coveragePercent).toBe(70);
    expect(result.blockedBy).toEqual([]);
  });

  it("يُظهر التعارض بين القراءة الأساسية وICT بدل تحويله إلى حياد صامت", () => {
    const result = calculateUnifiedDecision({ core: makeCore("buy"), ict: makeIct("SELL"), nowMs: NOW });

    expect(result.state).toBe("conflicted");
    expect(result.blockedBy).toContain("core_ict_conflict");
  });

  it("يطلب التأكيد عندما تحجب بوابة ICT الإشارة الأساسية", () => {
    const result = calculateUnifiedDecision({
      core: makeCore("buy"),
      ict: makeIct("WAIT", { blockedByIct: "BUY", bull: 3, bear: 1 }),
      nowMs: NOW,
    });

    expect(result.state).toBe("needs_confirmation");
    expect(result.blockedBy).toContain("ict_gate");
    expect(result.pillars.find(pillar => pillar.id === "ict")?.contribution).toBe(0);
  });

  it("يخفض الحالة إلى بيانات غير كافية عند استخدام مصدر تاريخ الشموع الاحتياطي", () => {
    const result = calculateUnifiedDecision({ core: makeCore("buy", "candle-history"), ict: makeIct("BUY"), nowMs: NOW });

    expect(result.state).toBe("insufficient_data");
    expect(result.blockedBy).toContain("data_quality");
  });

  it("يعيد النتيجة نفسها عند استخدام المدخلات والزمن نفسيهما", () => {
    const input = { core: makeCore("buy"), ict: makeIct("BUY"), nowMs: NOW };

    expect(calculateUnifiedDecision(input)).toEqual(calculateUnifiedDecision(input));
  });
});

import type { MultiTimeframeAnalysis, MultiTimeframeFrame } from "./technicalAnalysis";
import { getMarketAssetProfile } from "./marketAssetProfile";

export type TimeframeDirection = "bullish" | "bearish" | "neutral";

function normalizeDirection(value: string | null): TimeframeDirection {
  const normalized = String(value ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (/(strongbuy|buy|bullish|uptrend|long)/.test(normalized)) return "bullish";
  if (/(strongsell|sell|bearish|downtrend|short)/.test(normalized)) return "bearish";
  return "neutral";
}

function frameView(frame: MultiTimeframeFrame) {
  return {
    timeframe: frame.timeframe,
    label: frame.label ?? frame.timeframe,
    direction: normalizeDirection(frame.bias ?? frame.marketStructure),
    score: frame.score,
    rsi: frame.rsi,
    momentumAligned: frame.momentumAligned,
    structure: frame.marketStructure,
  };
}

export function summarizeTimeframeAlignment(analysis: MultiTimeframeAnalysis | undefined) {
  const frames = Object.values(analysis?.frames ?? {}).map(frameView);
  const directional = frames.filter(frame => frame.direction !== "neutral");
  const bullish = directional.filter(frame => frame.direction === "bullish").length;
  const bearish = directional.filter(frame => frame.direction === "bearish").length;
  const dominantDirection: TimeframeDirection = bullish > bearish ? "bullish" : bearish > bullish ? "bearish" : "neutral";
  const dominantCount = Math.max(bullish, bearish);
  const agreementPercent = directional.length ? Math.round((dominantCount / directional.length) * 100) : 0;
  return {
    frames,
    bullish,
    bearish,
    dominantDirection,
    agreementPercent,
    divergentTimeframes: analysis?.alignment.divergentTimeframes ?? [],
    netScore: analysis?.alignment.netScore ?? null,
    sourceStatus: analysis?.alignment.status ?? null,
    confidence: analysis?.alignment.confidence ?? null,
  };
}

export function measureAtr(symbol: string, exchange: string, atr: number | null, price: number | null) {
  const profile = getMarketAssetProfile(symbol, exchange);
  if (atr === null || !Number.isFinite(atr) || atr <= 0) return { value: null, unit: null, label: "ATR غير متاح", percentOfPrice: null, digits: 2 };
  if (profile.kind === "forex") {
    const pipSize = symbol.trim().toUpperCase().endsWith("JPY") ? 0.01 : 0.0001;
    return { value: atr / pipSize, unit: "pips", label: "نطاق ATR", percentOfPrice: price && price > 0 ? (atr / price) * 100 : null, digits: 1 };
  }
  if (profile.kind === "metal") {
    const pointSize = symbol.trim().toUpperCase() === "XAGUSD" ? 0.001 : 0.01;
    return { value: atr / pointSize, unit: "نقطة سعرية", label: "نطاق ATR", percentOfPrice: price && price > 0 ? (atr / price) * 100 : null, digits: 0 };
  }
  return { value: atr, unit: "وحدة سعر", label: "نطاق ATR", percentOfPrice: price && price > 0 ? (atr / price) * 100 : null, digits: profile.priceDigits };
}

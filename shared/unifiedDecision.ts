import type { CorrelationContext } from "./correlationContext";
import type { ChartIndicatorResult } from "./confluenceIct";
import type { MultiTimeframeAnalysis, TechnicalAnalysis, TechnicalSignal } from "./technicalAnalysis";

export type DecisionState =
  | "aligned_bullish"
  | "aligned_bearish"
  | "needs_confirmation"
  | "conflicted"
  | "insufficient_data"
  | "neutral";

export type DecisionDirection = "bullish" | "bearish" | "neutral";
export type DecisionFreshness = "fresh" | "stale" | "unknown";
export type DecisionPillarId = "core" | "ict" | "timeframes" | "correlation";

export type DecisionBlockedBy =
  | "ict_gate"
  | "data_quality"
  | "timeframe_conflict"
  | "core_ict_conflict";

export type DecisionPillar = {
  id: DecisionPillarId;
  available: boolean;
  direction: DecisionDirection;
  contribution: number;
  weight: number;
  freshness: DecisionFreshness;
  summary: string;
  reasons: string[];
};

export type UnifiedDecisionSummary = {
  version: "v1";
  state: DecisionState;
  direction: DecisionDirection;
  evidenceScore: number;
  coveragePercent: number;
  blockedBy: DecisionBlockedBy[];
  pillars: DecisionPillar[];
  summary: string;
  educationalDisclaimer: string;
  computedAt: number;
};

export type UnifiedDecisionInput = {
  core: TechnicalAnalysis | null | undefined;
  ict: ChartIndicatorResult | null | undefined;
  timeframes?: MultiTimeframeAnalysis | null;
  correlation?: CorrelationContext | null;
  nowMs?: number;
  freshnessMaxAgeMs?: number;
};

const PILLAR_WEIGHTS: Record<DecisionPillarId, number> = {
  core: 35,
  ict: 35,
  timeframes: 20,
  correlation: 10,
};

const DEFAULT_FRESHNESS_MAX_AGE_MS = 15 * 60 * 1000;
const EDUCATIONAL_DISCLAIMER =
  "هذا ملخص تعليمي لاتفاق الأدلة المتاحة، وليس توقعًا للربح أو أمرًا بالتداول.";

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function round(value: number, decimals = 0) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function directionFromSignal(signal: TechnicalSignal | string | null | undefined): DecisionDirection {
  if (signal === "strong_buy" || signal === "buy" || signal === "BUY") return "bullish";
  if (signal === "strong_sell" || signal === "sell" || signal === "SELL") return "bearish";
  return "neutral";
}

function opposite(direction: DecisionDirection): DecisionDirection {
  if (direction === "bullish") return "bearish";
  if (direction === "bearish") return "bullish";
  return "neutral";
}

function signed(direction: DecisionDirection, points: number) {
  if (direction === "bullish") return points;
  if (direction === "bearish") return -points;
  return 0;
}

function freshnessOf(fetchedAt: string | null | undefined, nowMs: number, maxAgeMs: number): DecisionFreshness {
  if (!fetchedAt) return "unknown";
  const timestamp = Date.parse(fetchedAt);
  if (!Number.isFinite(timestamp)) return "unknown";
  return nowMs - timestamp <= maxAgeMs ? "fresh" : "stale";
}

function corePillar(core: TechnicalAnalysis | null | undefined, nowMs: number, maxAgeMs: number): DecisionPillar {
  const weight = PILLAR_WEIGHTS.core;
  if (!core) {
    return {
      id: "core",
      available: false,
      direction: "neutral",
      contribution: 0,
      weight,
      freshness: "unknown",
      summary: "القراءة الأساسية غير متاحة.",
      reasons: ["لم تصل نتيجة مطبّعة من مزود التحليل."],
    };
  }

  const direction = directionFromSignal(core.recommendation.signal);
  const confidence = clamp((core.recommendation.confidence ?? 0) / 100);
  const freshness = freshnessOf(core.fetchedAt, nowMs, maxAgeMs);
  const available = direction !== "neutral" || core.recommendation.signal === "neutral";
  const contribution = round(signed(direction, weight * confidence), 2);
  const reasons = [
    `الإشارة الأساسية: ${core.recommendation.signal ?? "غير متاحة"}.`,
    core.source === "candle-history" ? "المصدر احتياطي قائم على تاريخ الشموع." : "المصدر الأساسي متاح.",
  ];

  return {
    id: "core",
    available,
    direction,
    contribution,
    weight,
    freshness,
    summary: direction === "neutral"
      ? "القراءة الأساسية محايدة أو بلا اتجاه واضح."
      : `القراءة الأساسية ${direction === "bullish" ? "صاعدة" : "هابطة"} بثقة ${round(confidence * 100)}%.`,
    reasons,
  };
}

function ictPillar(ict: ChartIndicatorResult | null | undefined): DecisionPillar {
  const weight = PILLAR_WEIGHTS.ict;
  if (!ict) {
    return {
      id: "ict",
      available: false,
      direction: "neutral",
      contribution: 0,
      weight,
      freshness: "unknown",
      summary: "تأكيد Confluence ICT غير متاح.",
      reasons: ["لم تُحسب نتيجة Confluence ICT لهذه السلسلة."],
    };
  }

  const signal = ict.summary.signal;
  const direction = directionFromSignal(signal);
  const score = direction === "bullish" ? ict.summary.ict.bull : direction === "bearish" ? ict.summary.ict.bear : 0;
  const max = Math.max(ict.summary.ict.max, 1);
  const strength = clamp(score / max);
  const blockedByIct = ict.summary.decision.blockedByIct !== null;
  const gatePassed = !blockedByIct;
  const contribution = round(signed(direction, weight * strength * (gatePassed ? 1 : 0)), 2);
  const reasons = [
    `إشارة ICT: ${signal}.`,
    `درجة ICT: ${score}/${max}.`,
  ];
  if (blockedByIct) reasons.push("بوابة ICT حجبت الإشارة الحالية.");

  return {
    id: "ict",
    available: true,
    direction,
    contribution,
    weight,
    freshness: "fresh",
    summary: direction === "neutral"
      ? "Confluence ICT لم يؤكد اتجاهًا حاليًا."
      : gatePassed
        ? `Confluence ICT يؤكد اتجاهًا ${direction === "bullish" ? "صاعدًا" : "هابطًا"} بدرجة ${round(strength * 100)}%.`
        : "Confluence ICT لم يجتز بوابة التأكيد.",
    reasons,
  };
}

function timeframePillar(
  timeframes: MultiTimeframeAnalysis | null | undefined,
  coreDirection: DecisionDirection,
  nowMs: number,
  maxAgeMs: number,
): DecisionPillar {
  const weight = PILLAR_WEIGHTS.timeframes;
  if (!timeframes) {
    return {
      id: "timeframes",
      available: false,
      direction: "neutral",
      contribution: 0,
      weight,
      freshness: "unknown",
      summary: "توافق الأطر غير محمّل.",
      reasons: ["لم تصل نتيجة التوافق متعدد الأطر."],
    };
  }

  const directions = Object.values(timeframes.frames)
    .map(frame => directionFromSignal(frame.bias ?? frame.advice))
    .filter((direction): direction is Exclude<DecisionDirection, "neutral"> => direction !== "neutral");
  const bullish = directions.filter(direction => direction === "bullish").length;
  const bearish = directions.filter(direction => direction === "bearish").length;
  const direction: DecisionDirection = bullish === bearish ? directionFromSignal(timeframes.recommendation.signal) : bullish > bearish ? "bullish" : "bearish";
  const total = directions.length;
  const agreement = total ? Math.max(bullish, bearish) / total : 0;
  const contribution = round(signed(direction, weight * agreement), 2);
  const reasons = [
    `الاتجاه الغالب عبر الأطر: ${direction}.`,
    `تغطية الأطر الاتجاهية: ${total}.`,
  ];
  if (timeframes.alignment.divergentTimeframes.length) {
    reasons.push(`أطر متعارضة: ${timeframes.alignment.divergentTimeframes.join(", ")}.`);
  }

  return {
    id: "timeframes",
    available: total > 0 || Boolean(timeframes.recommendation.signal),
    direction,
    contribution: coreDirection === "neutral" ? contribution : contribution,
    weight,
    freshness: freshnessOf(timeframes.fetchedAt, nowMs, maxAgeMs),
    summary: total
      ? `توافق الأطر يميل ${direction === "bullish" ? "للصعود" : direction === "bearish" ? "للهبوط" : "للحياد"} بنسبة ${round(agreement * 100)}%.`
      : "لا توجد أطر اتجاهية كافية للحساب.",
    reasons,
  };
}

function correlationPillar(
  correlation: CorrelationContext | null | undefined,
  coreDirection: DecisionDirection,
  nowMs: number,
  maxAgeMs: number,
): DecisionPillar {
  const weight = PILLAR_WEIGHTS.correlation;
  if (!correlation) {
    return {
      id: "correlation",
      available: false,
      direction: "neutral",
      contribution: 0,
      weight,
      freshness: "unknown",
      summary: "السياق المترابط غير متاح.",
      reasons: ["لم يُحمّل سياق الأصول المرتبطة."],
    };
  }

  const aligned = correlation.items.filter(item => item.status === "aligned").length;
  const divergent = correlation.items.filter(item => item.status === "divergent").length;
  const usable = aligned + divergent;
  const contextDirection = coreDirection === "neutral"
    ? "neutral"
    : aligned >= divergent ? coreDirection : opposite(coreDirection);
  const quality = correlation.assessment === "strong"
    ? 1
    : correlation.assessment === "moderate"
      ? 0.7
      : correlation.assessment === "weak"
        ? 0.35
        : correlation.assessment === "conflicted"
          ? 0.7
          : 0;
  const contribution = usable === 0 ? 0 : round(signed(contextDirection, weight * quality), 2);

  return {
    id: "correlation",
    available: usable > 0,
    direction: contextDirection,
    contribution,
    weight,
    freshness: freshnessOf(correlation.fetchedAt, nowMs, maxAgeMs),
    summary: correlation.summary,
    reasons: [`التقييم السياقي: ${correlation.assessment}.`, `متوافق: ${aligned}، متعارض: ${divergent}.`],
  };
}

function hasStrongTimeframeConflict(timeframes: MultiTimeframeAnalysis | null | undefined) {
  return Boolean(timeframes?.alignment.divergentTimeframes.length && timeframes.alignment.divergentTimeframes.length >= 2);
}

export function calculateUnifiedDecision(input: UnifiedDecisionInput): UnifiedDecisionSummary {
  const computedAt = input.nowMs ?? Date.now();
  const maxAgeMs = input.freshnessMaxAgeMs ?? DEFAULT_FRESHNESS_MAX_AGE_MS;
  const core = corePillar(input.core, computedAt, maxAgeMs);
  const ict = ictPillar(input.ict);
  const timeframes = timeframePillar(input.timeframes, core.direction, computedAt, maxAgeMs);
  const correlation = correlationPillar(input.correlation, core.direction, computedAt, maxAgeMs);
  const pillars = [core, ict, timeframes, correlation];
  const availableWeight = pillars.reduce((sum, pillar) => sum + (pillar.available ? pillar.weight : 0), 0);
  const effectiveCoverageWeight = pillars.reduce((sum, pillar) => {
    if (!pillar.available) return sum;
    if (pillar.freshness === "fresh") return sum + pillar.weight;
    return sum + pillar.weight * 0.5;
  }, 0);
  const netScore = pillars.reduce((sum, pillar) => sum + pillar.contribution, 0);
  const evidenceScore = availableWeight ? round(clamp(Math.abs(netScore) / availableWeight) * 100) : 0;
  const coveragePercent = round(clamp(effectiveCoverageWeight / Object.values(PILLAR_WEIGHTS).reduce((sum, weight) => sum + weight, 0)) * 100);
  const blockedBy: DecisionBlockedBy[] = [];
  const ictBlocked = input.ict?.summary.decision.blockedByIct !== null && input.ict?.summary.decision.blockedByIct !== undefined;
  const coreFallback = input.core?.source === "candle-history";

  if (ictBlocked) blockedBy.push("ict_gate");
  if (coreFallback || pillars.some(pillar => pillar.available && pillar.freshness === "stale")) blockedBy.push("data_quality");
  if (hasStrongTimeframeConflict(input.timeframes)) blockedBy.push("timeframe_conflict");
  if (core.direction !== "neutral" && ict.direction !== "neutral" && core.direction !== ict.direction) blockedBy.push("core_ict_conflict");

  const coreIctConflict = blockedBy.includes("core_ict_conflict");
  const ictNeedsConfirmation = blockedBy.includes("ict_gate") || (core.direction !== "neutral" && ict.direction === "neutral");
  const insufficient = !core.available || coveragePercent < 25 || coreFallback;
  const direction: DecisionDirection = netScore > 0 ? "bullish" : netScore < 0 ? "bearish" : core.direction !== "neutral" ? core.direction : ict.direction;

  let state: DecisionState;
  if (insufficient) state = "insufficient_data";
  else if (coreIctConflict || hasStrongTimeframeConflict(input.timeframes)) state = "conflicted";
  else if (ictNeedsConfirmation) state = "needs_confirmation";
  else if (core.direction === "bullish" && ict.direction === "bullish") state = "aligned_bullish";
  else if (core.direction === "bearish" && ict.direction === "bearish") state = "aligned_bearish";
  else if (direction === "neutral") state = "neutral";
  else state = "needs_confirmation";

  const summary = state === "aligned_bullish"
    ? "القراءة الأساسية وConfluence ICT متفقان صعودًا ضمن البيانات المتاحة."
    : state === "aligned_bearish"
      ? "القراءة الأساسية وConfluence ICT متفقان هبوطًا ضمن البيانات المتاحة."
      : state === "conflicted"
        ? "توجد عوامل متعارضة؛ لا ينبغي اختزالها في اتجاه حاسم."
        : state === "needs_confirmation"
          ? "يوجد اتجاه أولي، لكن تأكيد ICT أو توافق الأطر ما زال غير مكتمل."
          : state === "insufficient_data"
            ? "البيانات المتاحة غير كافية لإنتاج تلخيص موحّد قوي."
            : "لا تتكون أفضلية اتجاهية واضحة من الأدلة المتاحة.";

  return {
    version: "v1",
    state,
    direction,
    evidenceScore,
    coveragePercent,
    blockedBy,
    pillars,
    summary,
    educationalDisclaimer: EDUCATIONAL_DISCLAIMER,
    computedAt,
  };
}

export { PILLAR_WEIGHTS, DEFAULT_FRESHNESS_MAX_AGE_MS };

export type PaperTradeDraft = {
  symbol: string;
  exchange: string;
  assetClass: "crypto" | "stock" | "forex" | "futures";
  side: "long" | "short";
  quantity: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  note: string;
};

type AnalysisRiskInput = {
  supportLevels?: unknown;
  resistanceLevels?: unknown;
};

export type RiskLevelSource = {
  kind: "support" | "resistance" | "fallback";
  level?: number;
  label: string;
};

export type TradeRiskAssessment = {
  warnings: string[];
  riskRewardRatio: number | null;
  hasCompletePlan: boolean;
};

const PAPER_TRADE_DRAFT_KEY = "amic.paper-trade-draft.v1";

export function assetClassForExchange(exchange: string): PaperTradeDraft["assetClass"] {
  const normalized = exchange.trim().toUpperCase();
  if (normalized === "BINANCE" || normalized === "KUCOIN") return "crypto";
  if (normalized === "FX" || normalized === "FOREX") return "forex";
  if (normalized === "OZ" || normalized === "COMEX") return "futures";
  return "stock";
}

export function recommendationToSide(value: unknown): PaperTradeDraft["side"] | null {
  const normalized = String(value ?? "").toLowerCase().replace(/[ -]/g, "_");
  if (normalized === "buy" || normalized === "strong_buy" || normalized === "bullish" || normalized === "long") return "long";
  if (normalized === "sell" || normalized === "strong_sell" || normalized === "bearish" || normalized === "short") return "short";
  return null;
}

function collectPriceLevels(value: unknown, depth = 0): number[] {
  if (depth > 3 || value === null || value === undefined) return [];
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? [value] : [];
  if (typeof value === "string") {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) && parsed > 0 ? [parsed] : [];
  }
  if (Array.isArray(value)) return value.flatMap(item => collectPriceLevels(item, depth + 1));
  if (typeof value === "object") return Object.values(value as Record<string, unknown>).flatMap(item => collectPriceLevels(item, depth + 1));
  return [];
}

function roundRiskLevel(value: number, entryPrice: number) {
  const precision = entryPrice < 1 ? 8 : entryPrice < 100 ? 4 : 2;
  return value.toFixed(precision);
}

export function suggestRiskLevels(side: PaperTradeDraft["side"], entryPrice: number, levels: AnalysisRiskInput = {}) {
  const supports = collectPriceLevels(levels.supportLevels).filter(level => level < entryPrice).sort((a, b) => b - a);
  const resistances = collectPriceLevels(levels.resistanceLevels).filter(level => level > entryPrice).sort((a, b) => a - b);
  const nearestSupport = supports[0];
  const nearestResistance = resistances[0];

  if (side === "long") {
    const stopLoss = nearestSupport ? nearestSupport * 0.997 : entryPrice * 0.98;
    const risk = entryPrice - stopLoss;
    const takeProfit = nearestResistance ?? entryPrice + risk * 2;
    return {
      stopLoss: roundRiskLevel(stopLoss, entryPrice),
      takeProfit: roundRiskLevel(takeProfit, entryPrice),
      basis: nearestSupport || nearestResistance ? "مستويات الدعم/المقاومة المتاحة" : "هامش احتياطي عند غياب مستويات دعم/مقاومة صالحة",
      stopLossSource: nearestSupport
        ? { kind: "support" as const, level: nearestSupport, label: `دعم التحليل عند ${roundRiskLevel(nearestSupport, entryPrice)}` }
        : { kind: "fallback" as const, label: "هامش احتياطي 2% من سعر الدخول" },
      takeProfitSource: nearestResistance
        ? { kind: "resistance" as const, level: nearestResistance, label: `مقاومة التحليل عند ${roundRiskLevel(nearestResistance, entryPrice)}` }
        : { kind: "fallback" as const, label: "هدف احتياطي بنسبة 2R" },
    };
  }

  const stopLoss = nearestResistance ? nearestResistance * 1.003 : entryPrice * 1.02;
  const risk = stopLoss - entryPrice;
  const takeProfit = nearestSupport ?? entryPrice - risk * 2;
  return {
    stopLoss: roundRiskLevel(stopLoss, entryPrice),
    takeProfit: roundRiskLevel(takeProfit, entryPrice),
    basis: nearestSupport || nearestResistance ? "مستويات الدعم/المقاومة المتاحة" : "هامش احتياطي عند غياب مستويات دعم/مقاومة صالحة",
    stopLossSource: nearestResistance
      ? { kind: "resistance" as const, level: nearestResistance, label: `مقاومة التحليل عند ${roundRiskLevel(nearestResistance, entryPrice)}` }
      : { kind: "fallback" as const, label: "هامش احتياطي 2% من سعر الدخول" },
    takeProfitSource: nearestSupport
      ? { kind: "support" as const, level: nearestSupport, label: `دعم التحليل عند ${roundRiskLevel(nearestSupport, entryPrice)}` }
      : { kind: "fallback" as const, label: "هدف احتياطي بنسبة 2R" },
  };
}

function parseOptionalPrice(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return { present: false, value: null };
  const parsed = Number(trimmed.replace(/,/g, ""));
  return { present: true, value: Number.isFinite(parsed) && parsed > 0 ? parsed : null };
}

export function assessTradeRisk(input: Pick<PaperTradeDraft, "side" | "entryPrice" | "stopLoss" | "takeProfit">): TradeRiskAssessment {
  const entry = parseOptionalPrice(input.entryPrice);
  const stopLoss = parseOptionalPrice(input.stopLoss);
  const takeProfit = parseOptionalPrice(input.takeProfit);
  const warnings: string[] = [];

  if (!entry.value && (stopLoss.present || takeProfit.present)) warnings.push("أدخل سعر دخول موجبًا لحساب المخاطرة والعائد.");
  if (stopLoss.present && !stopLoss.value) warnings.push("قيمة وقف الخسارة يجب أن تكون رقمًا موجبًا.");
  if (takeProfit.present && !takeProfit.value) warnings.push("قيمة جني الربح يجب أن تكون رقمًا موجبًا.");

  if (entry.value && stopLoss.value) {
    const stopIsReversed = input.side === "long" ? stopLoss.value >= entry.value : stopLoss.value <= entry.value;
    if (stopIsReversed) warnings.push(input.side === "long" ? "للشراء، يجب أن يكون وقف الخسارة أقل من سعر الدخول." : "للبيع، يجب أن يكون وقف الخسارة أعلى من سعر الدخول.");
  }
  if (entry.value && takeProfit.value) {
    const targetIsReversed = input.side === "long" ? takeProfit.value <= entry.value : takeProfit.value >= entry.value;
    if (targetIsReversed) warnings.push(input.side === "long" ? "للشراء، يجب أن يكون جني الربح أعلى من سعر الدخول." : "للبيع، يجب أن يكون جني الربح أقل من سعر الدخول.");
  }

  const hasCompletePlan = Boolean(entry.value && stopLoss.value && takeProfit.value);
  const riskRewardRatio = hasCompletePlan && warnings.length === 0
    ? input.side === "long"
      ? (takeProfit.value! - entry.value!) / (entry.value! - stopLoss.value!)
      : (entry.value! - takeProfit.value!) / (stopLoss.value! - entry.value!)
    : null;

  return { warnings, riskRewardRatio: Number.isFinite(riskRewardRatio) && riskRewardRatio! > 0 ? riskRewardRatio : null, hasCompletePlan };
}

export function makeAnalysisTradeDraft(input: { symbol: string; exchange: string; recommendation: unknown; price: unknown; note: string } & AnalysisRiskInput): PaperTradeDraft | null {
  const side = recommendationToSide(input.recommendation);
  const entryPrice = Number(input.price);
  if (!side || !Number.isFinite(entryPrice) || entryPrice <= 0) return null;

  const riskLevels = suggestRiskLevels(side, entryPrice, input);
  return {
    symbol: input.symbol.trim().toUpperCase(),
    exchange: input.exchange.trim().toUpperCase(),
    assetClass: assetClassForExchange(input.exchange),
    side,
    quantity: "1",
    entryPrice: String(entryPrice),
    stopLoss: riskLevels.stopLoss,
    takeProfit: riskLevels.takeProfit,
    note: `${input.note} وقف الخسارة وجني الأرباح مقترحان من ${riskLevels.basis}، ويظلان قابلين للتعديل وليسا توصية استثمارية.`,
  };
}

export function storePaperTradeDraft(draft: PaperTradeDraft) {
  sessionStorage.setItem(PAPER_TRADE_DRAFT_KEY, JSON.stringify(draft));
}

export function consumePaperTradeDraft(): PaperTradeDraft | null {
  const raw = sessionStorage.getItem(PAPER_TRADE_DRAFT_KEY);
  sessionStorage.removeItem(PAPER_TRADE_DRAFT_KEY);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as PaperTradeDraft;
    if (!draft.symbol || !draft.exchange || !draft.entryPrice || !draft.side) return null;
    return draft;
  } catch {
    return null;
  }
}

import { getMarketAssetProfile } from "./marketAssetProfile";
import type { PriceLevel, PriceZone } from "./marketStructure";

export type StructureStrength = "strong" | "moderate" | "initial" | "invalidated";

export type StructureInsight = {
  id: string;
  type: "level" | "zone";
  title: string;
  source: string;
  strength: StructureStrength;
  strengthLabel: string;
  description: string;
  createdAt: number;
  invalidation: number;
  distanceToInvalidation: number | null;
  distanceUnit: string | null;
  digits: number;
  range?: { low: number; high: number };
  price?: number;
};

function distanceUnit(symbol: string, exchange: string) {
  const profile = getMarketAssetProfile(symbol, exchange);
  const normalized = symbol.trim().toUpperCase();
  if (profile.kind === "forex") return { size: normalized.endsWith("JPY") ? 0.01 : 0.0001, label: "pips", digits: 1 };
  if (profile.kind === "metal") return { size: normalized === "XAGUSD" ? 0.001 : 0.01, label: "نقطة سعرية", digits: 0 };
  return { size: 1, label: "وحدة سعر", digits: profile.priceDigits };
}

function strengthForLevel(touches: number): Pick<StructureInsight, "strength" | "strengthLabel"> {
  if (touches >= 3) return { strength: "strong", strengthLabel: "قوي" };
  if (touches === 2) return { strength: "moderate", strengthLabel: "متوسط" };
  return { strength: "initial", strengthLabel: "أولي" };
}

function strengthForZone(state: PriceZone["state"]): Pick<StructureInsight, "strength" | "strengthLabel"> {
  if (state === "fresh") return { strength: "strong", strengthLabel: "حديثة" };
  if (state === "tested") return { strength: "moderate", strengthLabel: "مختبرة" };
  return { strength: "invalidated", strengthLabel: "مُبطلة" };
}

function distance(currentPrice: number | null, invalidation: number, symbol: string, exchange: string) {
  if (currentPrice === null || !Number.isFinite(currentPrice) || !Number.isFinite(invalidation)) return { value: null, unit: null, digits: 2 };
  const unit = distanceUnit(symbol, exchange);
  const rawValue = Math.abs(currentPrice - invalidation) / unit.size;
  return { value: Number(rawValue.toFixed(unit.digits)), unit: unit.label, digits: unit.digits };
}

export function explainPriceLevel(level: PriceLevel, currentPrice: number | null, symbol: string, exchange: string): StructureInsight {
  const strength = strengthForLevel(level.touches);
  const riskDistance = distance(currentPrice, level.invalidation, symbol, exchange);
  const title = level.kind === "support" ? "دعم متجمع" : "مقاومة متجمعة";
  return {
    id: level.id,
    type: "level",
    title,
    source: level.kind === "support" ? "تجميع قيعان متأرجحة متقاربة" : "تجميع قمم متأرجحة متقاربة",
    ...strength,
    description: `${level.touches} ${level.touches === 1 ? "لمسة مؤكدة" : "لمسات متقاربة"}؛ يُعد كسر حد الإبطال إشارة إلى فقدان صلاحية المستوى في نطاق التحليل الحالي.`,
    createdAt: level.createdAt,
    invalidation: level.invalidation,
    distanceToInvalidation: riskDistance.value,
    distanceUnit: riskDistance.unit,
    digits: riskDistance.digits,
    price: level.price,
  };
}

export function explainPriceZone(zone: PriceZone, currentPrice: number | null, symbol: string, exchange: string): StructureInsight {
  const strength = strengthForZone(zone.state);
  const riskDistance = distance(currentPrice, zone.invalidation, symbol, exchange);
  return {
    id: zone.id,
    type: "zone",
    title: zone.kind === "demand" ? "منطقة طلب" : "منطقة عرض",
    source: zone.kind === "demand" ? "قاع متأرجح تبعه اندفاع صاعد مؤكد" : "قمة متأرجحة تبعها اندفاع هابط مؤكد",
    ...strength,
    description: zone.state === "fresh" ? "لم تُختبر المنطقة بعد وفق البيانات المحمّلة." : zone.state === "tested" ? "اختُبرت المنطقة؛ يلزم قراءة التفاعل معها ضمن الإطار الحالي." : "تجاوز السعر حد الإبطال؛ لا تُعامل المنطقة كمنطقة فعالة.",
    createdAt: zone.createdAt,
    invalidation: zone.invalidation,
    distanceToInvalidation: riskDistance.value,
    distanceUnit: riskDistance.unit,
    digits: riskDistance.digits,
    range: { low: zone.low, high: zone.high },
  };
}

export function explainStructureInsights(levels: PriceLevel[], zones: PriceZone[], currentPrice: number | null, symbol: string, exchange: string) {
  return [
    ...levels.map(level => explainPriceLevel(level, currentPrice, symbol, exchange)),
    ...zones.map(zone => explainPriceZone(zone, currentPrice, symbol, exchange)),
  ].sort((a, b) => b.createdAt - a.createdAt);
}

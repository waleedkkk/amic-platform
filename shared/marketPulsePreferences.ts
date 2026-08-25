export const MARKET_PULSE_MARKETS = [
  { id: "crypto", label: "الكريبتو", exchange: "BINANCE", description: "أصول Spot المتاحة عبر Binance" },
  { id: "stock", label: "الأسهم الأمريكية", exchange: "NASDAQ", description: "نتائج الفحص المتاحة عبر NASDAQ" },
] as const;

export type MarketPulseMarketId = (typeof MARKET_PULSE_MARKETS)[number]["id"];

export const MARKET_PULSE_SECTION_KEYS = [
  "cryptoGainers",
  "cryptoLosers",
  "stockGainers",
  "stockLosers",
] as const;

export type MarketPulseSectionKey = (typeof MARKET_PULSE_SECTION_KEYS)[number];

export const MARKET_PULSE_SECTIONS = [
  { key: "cryptoGainers", market: "crypto", direction: "gainers", title: "أبرز الرابحين — كريبتو", subtitle: "التغير على الإطار اليومي", exchange: "BINANCE" },
  { key: "cryptoLosers", market: "crypto", direction: "losers", title: "أبرز الخاسرين — كريبتو", subtitle: "التغير على الإطار اليومي", exchange: "BINANCE" },
  { key: "stockGainers", market: "stock", direction: "gainers", title: "أبرز الرابحين — أسهم", subtitle: "نتائج الفحص على NASDAQ", exchange: "NASDAQ" },
  { key: "stockLosers", market: "stock", direction: "losers", title: "أبرز الخاسرين — أسهم", subtitle: "نتائج الفحص على NASDAQ", exchange: "NASDAQ" },
] as const satisfies ReadonlyArray<{
  key: MarketPulseSectionKey;
  market: MarketPulseMarketId;
  direction: "gainers" | "losers";
  title: string;
  subtitle: string;
  exchange: string;
}>;

export const MARKET_PULSE_WIDGET_KEYS = [
  "summary",
  "preciousMetals",
  "watchlist",
  "correlation",
  "globalSnapshot",
  "assistantContext",
] as const;

export type MarketPulseWidgetKey = (typeof MARKET_PULSE_WIDGET_KEYS)[number];

export type MarketPulsePreferences = {
  sections: MarketPulseSectionKey[];
  widgets: MarketPulseWidgetKey[];
};

export const DEFAULT_MARKET_PULSE_SECTIONS: MarketPulseSectionKey[] = [...MARKET_PULSE_SECTION_KEYS];
export const DEFAULT_MARKET_PULSE_WIDGETS: MarketPulseWidgetKey[] = [...MARKET_PULSE_WIDGET_KEYS];
export const DEFAULT_MARKET_PULSE_PREFERENCES: MarketPulsePreferences = {
  sections: [...DEFAULT_MARKET_PULSE_SECTIONS],
  widgets: [...DEFAULT_MARKET_PULSE_WIDGETS],
};

export function isMarketPulseSectionKey(value: unknown): value is MarketPulseSectionKey {
  return typeof value === "string" && (MARKET_PULSE_SECTION_KEYS as readonly string[]).includes(value);
}

export function isMarketPulseWidgetKey(value: unknown): value is MarketPulseWidgetKey {
  return typeof value === "string" && (MARKET_PULSE_WIDGET_KEYS as readonly string[]).includes(value);
}

/** يعيد أقسامًا صالحة وغير فارغة، ويزيل التكرار والخيارات غير المعروفة القادمة من التخزين. */
export function normalizeMarketPulseSections(value: unknown): MarketPulseSectionKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_MARKET_PULSE_SECTIONS];
  const sections = Array.from(new Set(value.filter(isMarketPulseSectionKey)));
  return sections.length > 0 ? sections : [...DEFAULT_MARKET_PULSE_SECTIONS];
}

/** الوحدات اختيارية؛ غيابها في تفضيلات قديمة يعني إظهار الوحدات الافتراضية كلها. */
export function normalizeMarketPulseWidgets(value: unknown): MarketPulseWidgetKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_MARKET_PULSE_WIDGETS];
  return Array.from(new Set(value.filter(isMarketPulseWidgetKey)));
}

/** يقبل صفيف الأقسام القديم أو العقد الموسع الجديد حتى تبقى إعدادات المستخدمين الحالية صالحة. */
export function normalizeMarketPulsePreferences(value: unknown): MarketPulsePreferences {
  if (Array.isArray(value)) {
    return { sections: normalizeMarketPulseSections(value), widgets: [...DEFAULT_MARKET_PULSE_WIDGETS] };
  }
  if (!value || typeof value !== "object") return { ...DEFAULT_MARKET_PULSE_PREFERENCES, sections: [...DEFAULT_MARKET_PULSE_SECTIONS], widgets: [...DEFAULT_MARKET_PULSE_WIDGETS] };
  const candidate = value as { sections?: unknown; widgets?: unknown };
  return {
    sections: normalizeMarketPulseSections(candidate.sections),
    widgets: normalizeMarketPulseWidgets(candidate.widgets),
  };
}

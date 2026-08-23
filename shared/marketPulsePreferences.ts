export const MARKET_PULSE_SECTION_KEYS = [
  "cryptoGainers",
  "cryptoLosers",
  "stockGainers",
  "stockLosers",
] as const;

export type MarketPulseSectionKey = (typeof MARKET_PULSE_SECTION_KEYS)[number];

export const DEFAULT_MARKET_PULSE_SECTIONS: MarketPulseSectionKey[] = [...MARKET_PULSE_SECTION_KEYS];

export function isMarketPulseSectionKey(value: unknown): value is MarketPulseSectionKey {
  return typeof value === "string" && (MARKET_PULSE_SECTION_KEYS as readonly string[]).includes(value);
}

/** يعيد تفضيلًا صالحًا وغير فارغ، ويزيل التكرار والخيارات غير المعروفة القادمة من التخزين. */
export function normalizeMarketPulseSections(value: unknown): MarketPulseSectionKey[] {
  if (!Array.isArray(value)) return [...DEFAULT_MARKET_PULSE_SECTIONS];
  const sections = Array.from(new Set(value.filter(isMarketPulseSectionKey)));
  return sections.length > 0 ? sections : [...DEFAULT_MARKET_PULSE_SECTIONS];
}

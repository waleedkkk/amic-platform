export type MarketAssetKind = "metal" | "forex" | "crypto" | "equity" | "other";

export type MarketAssetProfile = {
  kind: MarketAssetKind;
  label: string;
  priceDigits: number;
  prioritizedTechnicalStatus: boolean;
};

const METAL_PROFILES: Record<string, MarketAssetProfile> = {
  XAUUSD: { kind: "metal", label: "الذهب / الدولار", priceDigits: 2, prioritizedTechnicalStatus: true },
  XAGUSD: { kind: "metal", label: "الفضة / الدولار", priceDigits: 3, prioritizedTechnicalStatus: true },
};

export function getMarketAssetProfile(symbol: string, exchange: string): MarketAssetProfile {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const normalizedExchange = exchange.trim().toUpperCase();
  const metal = METAL_PROFILES[normalizedSymbol];
  if (metal) return metal;
  if (normalizedExchange === "FX" && /^[A-Z]{6}$/.test(normalizedSymbol)) {
    return {
      kind: "forex",
      label: `${normalizedSymbol.slice(0, 3)}/${normalizedSymbol.slice(3)}`,
      priceDigits: normalizedSymbol.endsWith("JPY") ? 3 : 5,
      prioritizedTechnicalStatus: true,
    };
  }
  if (normalizedExchange === "BINANCE" || normalizedSymbol.endsWith("USDT")) return { kind: "crypto", label: normalizedSymbol, priceDigits: 4, prioritizedTechnicalStatus: false };
  if (["NASDAQ", "NYSE", "AMEX", "SSE"].includes(normalizedExchange)) return { kind: "equity", label: normalizedSymbol, priceDigits: 2, prioritizedTechnicalStatus: false };
  return { kind: "other", label: normalizedSymbol, priceDigits: 4, prioritizedTechnicalStatus: false };
}

export type CandleDataStatusInput = {
  provider?: "twelve-data" | "yahoo";
  sourceRole?: "primary" | "fallback";
  fetchedAt?: string;
};

const STALE_AFTER_MS: Record<string, number> = {
  "1m": 2 * 60_000,
  "5m": 10 * 60_000,
  "15m": 30 * 60_000,
  "60m": 2 * 60 * 60_000,
  "4h": 8 * 60 * 60_000,
  "1d": 30 * 60 * 60_000,
  "1wk": 9 * 24 * 60 * 60_000,
  "1mo": 45 * 24 * 60 * 60_000,
};

export function describeCandleDataStatus(input: CandleDataStatusInput | undefined, interval: string, now = Date.now()) {
  const providerLabel = input?.provider === "twelve-data" ? "Twelve Data" : input?.provider === "yahoo" ? "Yahoo Finance" : "غير محدد";
  const fetchedAtMs = input?.fetchedAt ? Date.parse(input.fetchedAt) : Number.NaN;
  const stale = !Number.isFinite(fetchedAtMs) || now - fetchedAtMs > (STALE_AFTER_MS[interval] ?? STALE_AFTER_MS["1d"]);
  const mode = stale ? "delayed" : input?.sourceRole === "fallback" ? "fallback" : "primary";
  return {
    providerLabel,
    fetchedAt: input?.fetchedAt ?? null,
    mode,
    badge: mode === "delayed" ? "بيانات مؤجلة" : mode === "fallback" ? "مصدر احتياطي" : "المصدر الأساسي",
    detail: mode === "delayed" ? "آخر شموع محفوظة أقدم من نافذة التحديث المتوقعة" : mode === "fallback" ? "تمت الاستعانة بالمصدر الاحتياطي بعد تعذر المصدر الأساسي" : "الشموع وصلت من المصدر الأساسي المتاح",
  } as const;
}

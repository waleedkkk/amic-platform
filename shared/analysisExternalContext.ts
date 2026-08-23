export type ExternalContextReference = { symbol: string; exchange: string };

export const EXTERNAL_CONTEXT_REFERENCE_OPTIONS = [
  { symbol: "XAUUSD", exchange: "FX", label: "الذهب / الدولار" },
  { symbol: "XAGUSD", exchange: "FX", label: "الفضة / الدولار" },
  { symbol: "EURUSD", exchange: "FX", label: "اليورو / الدولار" },
  { symbol: "GBPUSD", exchange: "FX", label: "الجنيه / الدولار" },
  { symbol: "USDJPY", exchange: "FX", label: "الدولار / الين" },
  { symbol: "SPY", exchange: "NYSE", label: "S&P 500 ETF" },
  { symbol: "QQQ", exchange: "NASDAQ", label: "Nasdaq 100 ETF" },
] as const;

export const MAX_EXTERNAL_CONTEXT_REFERENCES = 4;

export function normalizeExternalContextReferences(value: unknown): ExternalContextReference[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: ExternalContextReference[] = [];
  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") continue;
    const symbol = "symbol" in candidate && typeof candidate.symbol === "string" ? candidate.symbol.trim().toUpperCase() : "";
    const exchange = "exchange" in candidate && typeof candidate.exchange === "string" ? candidate.exchange.trim().toUpperCase() : "";
    if (!symbol || !exchange || symbol.length > 32 || exchange.length > 32) continue;
    const key = `${exchange}:${symbol}`;
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push({ symbol, exchange });
    if (normalized.length >= MAX_EXTERNAL_CONTEXT_REFERENCES) break;
  }
  return normalized;
}

export function correlationLabel(value: number | null) {
  if (value === null || !Number.isFinite(value)) return { label: "علاقة غير كافية", tone: "neutral" as const };
  const abs = Math.abs(value);
  if (abs >= 0.65) return { label: value > 0 ? "ارتباط موجب قوي" : "ارتباط سالب قوي", tone: value > 0 ? "positive" as const : "negative" as const };
  if (abs >= 0.3) return { label: value > 0 ? "ارتباط موجب متوسط" : "ارتباط سالب متوسط", tone: value > 0 ? "positive" as const : "negative" as const };
  return { label: "ارتباط ضعيف", tone: "neutral" as const };
}

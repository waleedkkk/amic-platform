export const CHART_INTERVALS = ["1m", "5m", "15m", "60m", "4h", "1d", "1wk", "1mo"] as const;
export type StoredChartInterval = (typeof CHART_INTERVALS)[number];

export function isStoredChartInterval(value: unknown): value is StoredChartInterval {
  return typeof value === "string" && (CHART_INTERVALS as readonly string[]).includes(value);
}

export function chartIntervalStorageKey(exchange: string, symbol: string) {
  return `amic:lastInterval:${exchange.trim().toUpperCase()}:${symbol.trim().toUpperCase()}`;
}

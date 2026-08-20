/**
 * Historical OHLCV candle provider.
 *
 * Source: Yahoo Finance public chart API (no API key required). It returns
 * fully indexed, timestamped OHLCV series for stocks, forex and crypto,
 * covering the exact same symbols family used across AMIC (TradingView-style
 * `EXCHANGE:NAME` symbols).
 *
 * Symbol mapping (TradingView-style -> Yahoo):
 *   NASDAQ:AAPL  -> AAPL
 *   NYSE:IBM     -> IBM
 *   AMEX:SPY     -> SPY
 *   FX:EURUSD    -> EURUSD=X
 *   BINANCE:BTCUSDT -> BTC-USD
 *
 * Rate-limit / reliability policy: responses are cached in the shared
 * marketSnapshots table so the provider is hit at most once per
 * (symbol, timeframe, range) tuple within the TTL. The API is public and
 * non-contractual, so all failures degrade to a clear error rather than
 * synthetic data (see docs/chart-scope.md).
 */
import { getMarketSnapshot, saveMarketSnapshot } from "./db";

export type CandleInterval = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1wk" | "1mo";

export type Candle = {
  time: number; // Unix seconds
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CandleHistory = {
  symbol: string;
  yahooSymbol: string;
  interval: CandleInterval;
  candles: Candle[];
  currency: string;
  exchangeName: string;
  regularMarketPrice: number | null;
  fetchedAt: string;
};

const CHART_TIMEOUT_MS = 25_000;
const CHART_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";

export function tvSymbolToYahoo(symbol: string, exchange: string): string {
  switch (exchange.toUpperCase()) {
    case "NASDAQ":
    case "NYSE":
    case "AMEX":
    case "OZ":
      return symbol;
    case "FX": {
      // EURUSD -> EURUSD=X ; USDCAD -> USDCAD=X
      const base = symbol.toUpperCase();
      return base.endsWith("X") ? base : `${base}=X`;
    }
    case "BINANCE": {
      // BTCUSDT / BTCUSD -> BTC-USD
      const base = symbol.toUpperCase().replace(/USDT$/, "").replace(/$/, "");
      return `${base}-USD`;
    }
    default:
      return `${exchange}:${symbol}`;
  }
}

interface YahooChartResult {
  meta: {
    symbol: string;
    currency: string;
    exchangeName: string;
    regularMarketPrice?: number;
    regularMarketTime?: number;
  };
  timestamp: number[];
  indicators: {
    quote: Array<{
      open: (number | null)[];
      high: (number | null)[];
      low: (number | null)[];
      close: (number | null)[];
      volume: (number | null)[];
    }>;
    adjclose?: Array<{ adjclose: (number | null)[] }>;
  };
  events?: unknown;
}

interface YahooChartResponse {
  chart: {
    result?: YahooChartResult[];
    error?: string;
  };
}

async function fetchJson(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHART_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": CHART_UA, Accept: "application/json" },
      signal: controller.signal,
    });
    if (!res.ok) {
      throw new Error(`chart provider HTTP ${res.status}`);
    }
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function buildCandles(result: YahooChartResult): Candle[] {
  const { timestamp } = result;
  const q = result.indicators.quote[0];
  const out: Candle[] = [];
  for (let i = 0; i < timestamp.length; i += 1) {
    const open = q.open[i];
    const high = q.high[i];
    const low = q.low[i];
    const close = q.close[i];
    if (open == null || high == null || low == null || close == null) continue;
    if (!Number.isFinite(open) || !Number.isFinite(high) || !Number.isFinite(low) || !Number.isFinite(close)) continue;
    out.push({
      time: timestamp[i],
      open,
      high,
      low,
      close,
      volume: q.volume[i] ?? 0,
    });
  }
  return out;
}

export async function fetchCandleHistory(
  symbol: string,
  exchange: string,
  interval: CandleInterval,
  range: string,
): Promise<CandleHistory> {
  const yahooSymbol = tvSymbolToYahoo(symbol, exchange);
  const url =
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}` +
    `?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;

  const raw = await fetchJson(url);
  let parsed: YahooChartResponse;
  try {
    parsed = JSON.parse(raw) as YahooChartResponse;
  } catch {
    throw new Error("chart provider returned invalid JSON");
  }

  const result = parsed.chart.result?.[0];
  if (!result) {
    throw new Error(parsed.chart.error ?? "chart provider returned no data");
  }

  const candles = buildCandles(result);
  if (candles.length === 0) {
    throw new Error("chart provider returned an empty candle series");
  }

  return {
    symbol,
    yahooSymbol,
    interval,
    candles,
    currency: result.meta.currency ?? "",
    exchangeName: result.meta.exchangeName ?? exchange,
    regularMarketPrice: result.meta.regularMarketPrice ?? null,
    fetchedAt: new Date().toISOString(),
  };
}

export async function getCandleHistoryCached(
  symbol: string,
  exchange: string,
  interval: CandleInterval,
  range: string,
): Promise<CandleHistory> {
  const cacheKey = `candles:${exchange}:${symbol}:${interval}:${range}`;
  const existing = await getMarketSnapshot(cacheKey);
  if (existing) return existing as CandleHistory;

  const history = await fetchCandleHistory(symbol, exchange, interval, range);
  // Cache the latest price briefly; the historical series is cached longer.
  await saveMarketSnapshot({
    cacheKey,
    market: "candles",
    exchange,
    timeframe: `${interval}:${range}`,
    payload: history,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000),
  });
  return history;
}

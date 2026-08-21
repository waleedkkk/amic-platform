/**
 * Historical OHLCV candle provider.
 *
 * Twelve Data هو المصدر الأساسي عند ضبط مفتاحه الخادمي، مع احتياط Yahoo Finance
 * للحفاظ على استمرارية الشارت عند عدم دعم رمز أو تعذر المزود المرخص.
 */
import { getMarketSnapshot, saveMarketSnapshot } from "./db";

export type CandleInterval = "1m" | "5m" | "15m" | "30m" | "60m" | "1d" | "1wk" | "1mo";

export type Candle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type CandleHistory = {
  symbol: string;
  yahooSymbol: string;
  provider?: "twelve-data" | "yahoo";
  interval: CandleInterval;
  candles: Candle[];
  currency: string;
  exchangeName: string;
  regularMarketPrice: number | null;
  fetchedAt: string;
};

const CHART_TIMEOUT_MS = 25_000;
const CHART_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com/time_series";

/** فواصل الشموع القصيرة تُحدّث بسرعة مضبوطة؛ البث المباشر للعملات لا يمر بهذا المسار. */
export function candleCacheTtlMs(interval: CandleInterval): number {
  if (interval === "1m" || interval === "5m") return 30_000;
  if (interval === "15m" || interval === "30m" || interval === "60m") return 60_000;
  return 5 * 60 * 1000;
}

export function tvSymbolToYahoo(symbol: string, exchange: string): string {
  switch (exchange.toUpperCase()) {
    case "NASDAQ":
    case "NYSE":
    case "AMEX":
    case "OZ":
      return symbol;
    case "FX": {
      const base = symbol.toUpperCase();
      return base.endsWith("X") ? base : `${base}=X`;
    }
    case "BINANCE": {
      const base = symbol.toUpperCase().replace(/USDT$/, "").replace(/USD$/, "");
      return `${base}-USD`;
    }
    default:
      return `${exchange}:${symbol}`;
  }
}

/** يحول رموز AMIC إلى صيغة Twelve Data من الخادم فقط. */
export function tvSymbolToTwelveData(symbol: string, exchange: string): string {
  const upperSymbol = symbol.trim().toUpperCase();
  const upperExchange = exchange.trim().toUpperCase();
  if (upperExchange === "FX" && /^[A-Z]{6}$/.test(upperSymbol)) return `${upperSymbol.slice(0, 3)}/${upperSymbol.slice(3)}`;
  if (upperExchange === "BINANCE") {
    const base = upperSymbol.replace(/USDT$/, "").replace(/USD$/, "");
    return `${base}/USD`;
  }
  if (["XAUUSD", "XAGUSD"].includes(upperSymbol)) return `${upperSymbol.slice(0, 3)}/${upperSymbol.slice(3)}`;
  return upperSymbol;
}

export function twelveDataInterval(interval: CandleInterval): string {
  if (interval === "60m") return "1h";
  if (interval === "1d") return "1day";
  if (interval === "1wk") return "1week";
  if (interval === "1mo") return "1month";
  return interval;
}

function twelveDataOutputSize(range: string): number {
  if (range === "5d") return 1_000;
  if (range === "1mo") return 1_500;
  if (range === "6mo") return 3_000;
  return 5_000;
}

interface YahooChartResult {
  meta: { symbol: string; currency: string; exchangeName: string; regularMarketPrice?: number };
  timestamp: number[];
  indicators: { quote: Array<{ open: (number | null)[]; high: (number | null)[]; low: (number | null)[]; close: (number | null)[]; volume: (number | null)[] }> };
}

interface YahooChartResponse {
  chart: { result?: YahooChartResult[]; error?: string };
}

interface TwelveDataResponse {
  message?: string;
  status?: "error";
  meta?: { currency?: string; exchange?: string };
  values?: Array<{ datetime: string; open: string; high: string; low: string; close: string; volume?: string }>;
}

async function fetchJson(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CHART_TIMEOUT_MS);
  try {
    const res = await fetch(url, { headers: { "User-Agent": CHART_UA, Accept: "application/json" }, signal: controller.signal });
    if (!res.ok) throw new Error(`chart provider HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

function buildCandles(result: YahooChartResult): Candle[] {
  const q = result.indicators.quote[0];
  const out: Candle[] = [];
  for (let i = 0; i < result.timestamp.length; i += 1) {
    const open = q.open[i];
    const high = q.high[i];
    const low = q.low[i];
    const close = q.close[i];
    if (open == null || high == null || low == null || close == null) continue;
    if (![open, high, low, close].every(Number.isFinite)) continue;
    out.push({ time: result.timestamp[i], open, high, low, close, volume: q.volume[i] ?? 0 });
  }
  return out;
}

function buildTwelveDataCandles(values: NonNullable<TwelveDataResponse["values"]>): Candle[] {
  return values
    .map(value => ({
      time: Math.floor(new Date(`${value.datetime.replace(" ", "T")}Z`).getTime() / 1000),
      open: Number(value.open), high: Number(value.high), low: Number(value.low), close: Number(value.close), volume: Number(value.volume ?? 0),
    }))
    .filter(candle => Number.isFinite(candle.time) && [candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite))
    .sort((left, right) => left.time - right.time);
}

export async function fetchTwelveDataCandleHistory(
  symbol: string,
  exchange: string,
  interval: CandleInterval,
  range: string,
  apiKey = process.env.TWELVE_DATA_API_KEY,
): Promise<CandleHistory> {
  if (!apiKey) throw new Error("Twelve Data API key is not configured");
  const providerSymbol = tvSymbolToTwelveData(symbol, exchange);
  const url = new URL(TWELVE_DATA_BASE_URL);
  url.searchParams.set("symbol", providerSymbol);
  url.searchParams.set("interval", twelveDataInterval(interval));
  url.searchParams.set("outputsize", String(twelveDataOutputSize(range)));
  url.searchParams.set("apikey", apiKey);
  const response = JSON.parse(await fetchJson(url.toString())) as TwelveDataResponse;
  if (response.status === "error" || !response.values?.length) throw new Error(response.message ?? "Twelve Data returned no candle data");
  const candles = buildTwelveDataCandles(response.values);
  if (!candles.length) throw new Error("Twelve Data returned invalid candle data");
  return {
    symbol, yahooSymbol: providerSymbol, provider: "twelve-data", interval, candles,
    currency: response.meta?.currency ?? "", exchangeName: response.meta?.exchange ?? exchange,
    regularMarketPrice: candles.at(-1)?.close ?? null, fetchedAt: new Date().toISOString(),
  };
}

export async function fetchCandleHistory(symbol: string, exchange: string, interval: CandleInterval, range: string): Promise<CandleHistory> {
  if (process.env.TWELVE_DATA_API_KEY) {
    try {
      return await fetchTwelveDataCandleHistory(symbol, exchange, interval, range);
    } catch (error) {
      console.warn(`[Candles] Twelve Data unavailable for ${exchange}:${symbol}; using Yahoo fallback`, error instanceof Error ? error.message : String(error));
    }
  }

  const yahooSymbol = tvSymbolToYahoo(symbol, exchange);
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?range=${encodeURIComponent(range)}&interval=${encodeURIComponent(interval)}`;
  const parsed = JSON.parse(await fetchJson(url)) as YahooChartResponse;
  const result = parsed.chart.result?.[0];
  if (!result) throw new Error(parsed.chart.error ?? "chart provider returned no data");
  const candles = buildCandles(result);
  if (!candles.length) throw new Error("chart provider returned an empty candle series");
  return {
    symbol, yahooSymbol, provider: "yahoo", interval, candles,
    currency: result.meta.currency ?? "", exchangeName: result.meta.exchangeName ?? exchange,
    regularMarketPrice: result.meta.regularMarketPrice ?? null, fetchedAt: new Date().toISOString(),
  };
}

export async function getCandleHistoryCached(symbol: string, exchange: string, interval: CandleInterval, range: string): Promise<CandleHistory> {
  const cacheKey = `candles:${exchange}:${symbol}:${interval}:${range}`;
  const existing = await getMarketSnapshot(cacheKey);
  if (existing) return existing as CandleHistory;
  const history = await fetchCandleHistory(symbol, exchange, interval, range);
  await saveMarketSnapshot({
    cacheKey, market: "candles", exchange, timeframe: `${interval}:${range}`, payload: history,
    expiresAt: new Date(Date.now() + candleCacheTtlMs(interval)),
  });
  return history;
}

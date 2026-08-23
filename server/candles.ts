/**
 * Historical OHLCV candle provider.
 *
 * Twelve Data هو المصدر الأساسي عند ضبط مفتاحه الخادمي، مع احتياط Yahoo Finance
 * للحفاظ على استمرارية الشارت عند عدم دعم رمز أو تعذر المزود المرخص.
 */
import { getMarketSnapshot, saveMarketSnapshot } from "./db";
import { createInFlightRequestCoalescer } from "./cacheCoalescing";

export type CandleInterval = "1m" | "5m" | "15m" | "30m" | "60m" | "4h" | "1d" | "1wk" | "1mo";

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
  sourceRole?: "primary" | "fallback";
  interval: CandleInterval;
  candles: Candle[];
  currency: string;
  exchangeName: string;
  regularMarketPrice: number | null;
  fetchedAt: string;
};

type MetalCandleFetchers = {
  apiKey?: string;
  tryTwelveData?: boolean;
  fetchTwelveData?: typeof fetchTwelveDataCandleHistory;
  fetchYahoo?: typeof fetchYahooCandleHistory;
};

const CHART_TIMEOUT_MS = 25_000;
const CHART_UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36";
const TWELVE_DATA_BASE_URL = "https://api.twelvedata.com/time_series";
const MIN_RENDERABLE_CANDLE_COUNT = 2;
const RANGE_SECONDS: Record<string, number> = {
  "1d": 24 * 60 * 60,
  "5d": 5 * 24 * 60 * 60,
  "1mo": 31 * 24 * 60 * 60,
  "3mo": 93 * 24 * 60 * 60,
  "6mo": 186 * 24 * 60 * 60,
  "1y": 366 * 24 * 60 * 60,
  "2y": 2 * 366 * 24 * 60 * 60,
  "5y": 5 * 366 * 24 * 60 * 60,
};

/** فواصل الشموع القصيرة تُحدّث بسرعة مضبوطة؛ البث المباشر للعملات لا يمر بهذا المسار. */
export function candleCacheTtlMs(interval: CandleInterval): number {
  if (interval === "1m" || interval === "5m") return 30_000;
  if (interval === "15m" || interval === "30m" || interval === "60m") return 60_000;
  return 5 * 60 * 1000;
}

export function resampleFourHourCandles(candles: Candle[]): Candle[] {
  const buckets = new Map<number, Candle>();
  for (const candle of candles) {
    const bucket = Math.floor(candle.time / (4 * 60 * 60)) * (4 * 60 * 60);
    const current = buckets.get(bucket);
    if (!current) buckets.set(bucket, { ...candle, time: bucket });
    else buckets.set(bucket, { ...current, high: Math.max(current.high, candle.high), low: Math.min(current.low, candle.low), close: candle.close, volume: current.volume + candle.volume });
  }
  return Array.from(buckets.values()).sort((left, right) => left.time - right.time);
}

/**
 * عمود timeframe في marketSnapshots يصف الإطار فقط (حتى 8 أحرف).
 * النطاق والحد جزءان من cacheKey، لذلك لا يجوز دمجهما هنا.
 */
export function candleSnapshotTimeframe(interval: CandleInterval): CandleInterval {
  return interval;
}

export function tvSymbolToYahoo(symbol: string, exchange: string): string {
  const upperSymbol = symbol.trim().toUpperCase();
  // Yahoo لا يوفر XAUUSD=X وXAGUSD=X كسلاسل شموع، بينما يوفر عقود COMEX
  // المتصلة GC=F وSI=F التي تمثل الذهب والفضة بأسعار تاريخية قابلة للرسم.
  if (upperSymbol === "XAUUSD") return "GC=F";
  if (upperSymbol === "XAGUSD") return "SI=F";
  switch (exchange.toUpperCase()) {
    case "NASDAQ":
    case "NYSE":
    case "AMEX":
    case "OZ":
      return symbol;
    case "FX": {
      const base = upperSymbol;
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
  if (interval === "4h") return "1h";
  if (interval === "60m") return "1h";
  if (interval === "1d") return "1day";
  if (interval === "1wk") return "1week";
  if (interval === "1mo") return "1month";
  return interval;
}

function normalizeCandleLimit(limit?: number): number {
  return Math.min(5_000, Math.max(60, Math.round(limit ?? 5_000)));
}

/**
 * نعرض التاريخ القصير الصالح بدل إخفاء المخطط بالكامل؛ تتطلب الشموع التاريخية
 * نقطتين على الأقل، بينما يمنع العميل دمج شمعة البث المنفردة عند غياب التاريخ.
 */
export function hasRenderableCandleHistory(candles: Candle[], limit?: number): boolean {
  void limit;
  return candles.length >= MIN_RENDERABLE_CANDLE_COUNT;
}

/** يمنع تمرير تاريخ ناقص أو شموع غير منطقية من أي مزود احتياطي إلى الرسم. */
export function hasValidCandleHistory(candles: Candle[], limit?: number): boolean {
  if (!hasRenderableCandleHistory(candles, limit)) return false;
  return candles.every((candle, index) => {
    const prices = [candle.open, candle.high, candle.low, candle.close, candle.volume];
    const previous = candles[index - 1];
    return prices.every(Number.isFinite)
      && candle.low <= Math.min(candle.open, candle.close)
      && candle.high >= Math.max(candle.open, candle.close)
      && (!previous || candle.time > previous.time);
  });
}

function twelveDataOutputSize(range: string, limit?: number): number {
  const rangeLimit = (() => {
    if (range === "5d") return 1_000;
    if (range === "1mo") return 1_500;
    if (range === "6mo") return 3_000;
    return 5_000;
  })();
  return Math.min(rangeLimit, normalizeCandleLimit(limit));
}

export function buildYahooCandleUrl(yahooSymbol: string, interval: CandleInterval, range: string, before?: number) {
  const url = new URL(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}`);
  url.searchParams.set("interval", interval);
  if (before && Number.isFinite(before) && before > 0) {
    const historySeconds = RANGE_SECONDS[range] ?? RANGE_SECONDS["6mo"];
    url.searchParams.set("period1", String(Math.max(0, Math.floor(before - historySeconds))));
    url.searchParams.set("period2", String(Math.floor(before)));
  } else {
    url.searchParams.set("range", range);
  }
  return url.toString();
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
  limit?: number,
  before?: number,
): Promise<CandleHistory> {
  if (!apiKey) throw new Error("Twelve Data API key is not configured");
  const providerSymbol = tvSymbolToTwelveData(symbol, exchange);
  const url = new URL(TWELVE_DATA_BASE_URL);
  url.searchParams.set("symbol", providerSymbol);
  url.searchParams.set("interval", twelveDataInterval(interval));
  const providerLimit = interval === "4h" ? normalizeCandleLimit(limit) * 4 : limit;
  url.searchParams.set("outputsize", String(twelveDataOutputSize(range, providerLimit)));
  if (before && Number.isFinite(before) && before > 0) {
    url.searchParams.set("end_date", new Date(before * 1_000).toISOString().slice(0, 19).replace("T", " "));
  }
  url.searchParams.set("apikey", apiKey);
  const response = JSON.parse(await fetchJson(url.toString())) as TwelveDataResponse;
  if (response.status === "error" || !response.values?.length) throw new Error(response.message ?? "Twelve Data returned no candle data");
  const candles = (interval === "4h" ? resampleFourHourCandles(buildTwelveDataCandles(response.values)) : buildTwelveDataCandles(response.values)).slice(-normalizeCandleLimit(limit));
  if (!hasRenderableCandleHistory(candles, limit)) {
    throw new Error("Twelve Data returned insufficient candle history");
  }
  return {
    symbol, yahooSymbol: providerSymbol, provider: "twelve-data", interval, candles,
    currency: response.meta?.currency ?? "", exchangeName: response.meta?.exchange ?? exchange,
    regularMarketPrice: candles.at(-1)?.close ?? null, fetchedAt: new Date().toISOString(),
  };
}

export async function fetchYahooCandleHistory(symbol: string, exchange: string, interval: CandleInterval, range: string, limit?: number, before?: number): Promise<CandleHistory> {
  const yahooSymbol = tvSymbolToYahoo(symbol, exchange);
  const providerInterval = interval === "4h" ? "60m" : interval;
  const url = buildYahooCandleUrl(yahooSymbol, providerInterval, range, before);
  const parsed = JSON.parse(await fetchJson(url)) as YahooChartResponse;
  const result = parsed.chart.result?.[0];
  if (!result) throw new Error(parsed.chart.error ?? "chart provider returned no data");
  const candles = (interval === "4h" ? resampleFourHourCandles(buildCandles(result)) : buildCandles(result)).slice(-normalizeCandleLimit(limit));
  if (!hasRenderableCandleHistory(candles, limit)) {
    throw new Error("chart provider returned insufficient candle history");
  }
  return {
    symbol, yahooSymbol, provider: "yahoo", interval, candles,
    currency: result.meta.currency ?? "", exchangeName: result.meta.exchangeName ?? exchange,
    regularMarketPrice: result.meta.regularMarketPrice ?? null, fetchedAt: new Date().toISOString(),
  };
}

export function isPreciousMetalSymbol(symbol: string) {
  return ["XAUUSD", "XAGUSD"].includes(symbol.trim().toUpperCase());
}

/**
 * سلسلة المعادن معزولة وصريحة: نفضّل Twelve Data، ثم ننتقل إلى عقود Yahoo
 * عند خطأ المصدر أو عودته بتاريخ غير صالح. لا تختلط هذه السياسة ببيانات الأسهم أو الكريبتو.
 */
export async function fetchMetalCandleHistory(
  symbol: string,
  exchange: string,
  interval: CandleInterval,
  range: string,
  limit?: number,
  before?: number,
  options: MetalCandleFetchers = {},
): Promise<CandleHistory> {
  const apiKey = options.apiKey ?? process.env.TWELVE_DATA_API_KEY;
  const tryTwelveData = options.tryTwelveData ?? Boolean(apiKey);
  const fetchTwelveData = options.fetchTwelveData ?? fetchTwelveDataCandleHistory;
  const fetchYahoo = options.fetchYahoo ?? fetchYahooCandleHistory;
  const errors: string[] = [];

  if (tryTwelveData) {
    try {
      const result = await fetchTwelveData(symbol, exchange, interval, range, apiKey, limit, before);
      if (hasValidCandleHistory(result.candles, limit)) return { ...result, sourceRole: "primary" };
      errors.push("Twelve Data returned invalid candle history");
    } catch (error) {
      errors.push(`Twelve Data: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  try {
    const result = await fetchYahoo(symbol, exchange, interval, range, limit, before);
    if (hasValidCandleHistory(result.candles, limit)) return { ...result, sourceRole: "fallback" };
    errors.push("Yahoo Finance returned invalid candle history");
  } catch (error) {
    errors.push(`Yahoo Finance: ${error instanceof Error ? error.message : String(error)}`);
  }

  throw new Error(`No valid metal candle history for ${exchange}:${symbol}. ${errors.join(" | ")}`);
}

export async function fetchCandleHistory(symbol: string, exchange: string, interval: CandleInterval, range: string, limit?: number, before?: number): Promise<CandleHistory> {
  if (isPreciousMetalSymbol(symbol)) return fetchMetalCandleHistory(symbol, exchange, interval, range, limit, before);

  if (process.env.TWELVE_DATA_API_KEY) {
    try {
      return await fetchTwelveDataCandleHistory(symbol, exchange, interval, range, undefined, limit, before);
    } catch (error) {
      console.warn(`[Candles] Twelve Data unavailable for ${exchange}:${symbol}; using Yahoo fallback`, error instanceof Error ? error.message : String(error));
    }
  }

  return fetchYahooCandleHistory(symbol, exchange, interval, range, limit, before);
}

const candleCacheCoalescer = createInFlightRequestCoalescer();
type CandleHistoryCacheOptions = { before?: number; fetchHistory?: typeof fetchCandleHistory };

export async function getCandleHistoryCached(
  symbol: string,
  exchange: string,
  interval: CandleInterval,
  range: string,
  limit?: number,
  optionsOrFetchHistory?: CandleHistoryCacheOptions | typeof fetchCandleHistory,
): Promise<CandleHistory> {
  const options = typeof optionsOrFetchHistory === "function" ? { fetchHistory: optionsOrFetchHistory } : optionsOrFetchHistory ?? {};
  const before = options.before;
  const fetchHistory = options.fetchHistory ?? fetchCandleHistory;
  const normalizedLimit = normalizeCandleLimit(limit);
  const beforePart = before && Number.isFinite(before) && before > 0 ? `:before:${Math.floor(before)}` : "";
  const cacheKey = `candles:${exchange}:${symbol}:${interval}:${range}:${normalizedLimit}${beforePart}`;
  const existing = await getMarketSnapshot(cacheKey);
  if (existing) {
    const cached = existing as CandleHistory;
    if (hasRenderableCandleHistory(cached.candles, normalizedLimit)) return cached;
  }
  return candleCacheCoalescer.run(cacheKey, async () => {
    const history = await fetchHistory(symbol, exchange, interval, range, normalizedLimit, before);
    try {
      await saveMarketSnapshot({
        cacheKey, market: "candles", exchange, timeframe: candleSnapshotTimeframe(interval), payload: history,
        expiresAt: new Date(Date.now() + candleCacheTtlMs(interval)),
      });
    } catch (error) {
      // الكاش تحسين أداء فقط؛ لا يجب أن يحجب تاريخ السعر الصحيح عن المخطط.
      console.warn(`[Candles] Failed to persist cache for ${cacheKey}; returning fresh history`, error instanceof Error ? error.message : String(error));
    }
    return history;
  });
}

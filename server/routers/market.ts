import { z } from "zod";
import { getCandleHistoryCached, type CandleHistory, type CandleInterval } from "../candles";
import { getMarketSnapshot, getUserChartPreferences, saveMarketSnapshot, saveUserChartPreferences } from "../db";
import { createInFlightRequestCoalescer } from "../cacheCoalescing";
import { callTradingViewTool, listTradingViewTools, TRADINGVIEW_TOOL_NAMES } from "../mcpClient";
import { getTwelveDataLiveQuote } from "../twelveDataStream";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { DEFAULT_CHART_PREFERENCES, normalizeChartPreferences } from "../../shared/chartPreferences";
import { normalizeMultiTimeframeAnalysis, normalizeTechnicalAnalysis } from "../technicalAnalysis";
import { correlationFromCandles } from "../../shared/correlation";

const timeframe = z.enum(["5m", "15m", "1h", "4h", "1D", "1W", "1M"]);
const candleInterval = z.enum(["1m", "5m", "15m", "30m", "60m", "4h", "1d", "1wk", "1mo"]);
const candleRange = z.enum(["1d", "5d", "1mo", "3mo", "6mo", "1y", "2y", "5y"]);
const sparklineRange = z.enum(["day", "week"]);
const chartLayers = z.object({
  sma: z.boolean(),
  ema: z.boolean(),
  levels: z.boolean(),
  zones: z.boolean(),
  events: z.boolean(),
  volume: z.boolean(),
});
const chartPreferencesInput = z.object({
  layers: chartLayers,
  confluenceIct: z.object({
    enabled: z.boolean(),
    trend: z.boolean(),
    structure: z.boolean(),
    liquidity: z.boolean(),
    zones: z.boolean(),
    signals: z.boolean(),
    summary: z.boolean(),
    settings: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
  }),
  priceScaleMode: z.enum(["normal", "logarithmic"]),
});
export type SparklineRange = z.infer<typeof sparklineRange>;

function intervalToRange(interval: CandleInterval): string {
  switch (interval) {
    case "1m":
    case "5m":
      return "1d";
    case "15m":
    case "30m":
      return "5d";
    case "60m":
      return "1mo";
    case "4h":
      return "3mo";
    case "1d":
      return "6mo";
    case "1wk":
      return "2y";
    case "1mo":
      return "5y";
    default:
      return "6mo";
  }
}
const toolName = z.enum(TRADINGVIEW_TOOL_NAMES);

const PRECIOUS_METALS = [
  { symbol: "XAUUSD", yahooSymbol: "GC=F", label: "الذهب", shortLabel: "XAU", precision: 2 },
  { symbol: "XAGUSD", yahooSymbol: "SI=F", label: "الفضة", shortLabel: "XAG", precision: 3 },
] as const;

const CORRELATION_ASSETS = [
  { id: "dxy", label: "DXY", symbol: "DX-Y.NYB", exchange: "NASDAQ" },
  { id: "gold", label: "الذهب", symbol: "GC=F", exchange: "OZ" },
  { id: "silver", label: "الفضة", symbol: "SI=F", exchange: "OZ" },
  { id: "spx", label: "S&P 500", symbol: "SPY", exchange: "NYSE" },
  { id: "nasdaq", label: "Nasdaq 100", symbol: "QQQ", exchange: "NASDAQ" },
] as const;

export type PreciousMetalQuote = {
  symbol: string;
  label: string;
  shortLabel: string;
  price: number;
  changePercent: number | null;
  sparklinePrices: number[];
  sparklineRange: SparklineRange;
  currency: string;
  precision: number;
};

export function toPreciousMetalQuote(
  metal: (typeof PRECIOUS_METALS)[number],
  history: CandleHistory,
  intradayHistory?: CandleHistory,
  range: SparklineRange = "day",
): PreciousMetalQuote {
  const latest = history.candles.at(-1);
  const previous = history.candles.at(-2);
  if (!latest) throw new Error(`لا تتوفر شموع حديثة لـ ${metal.symbol}`);
  const price = history.regularMarketPrice ?? latest.close;
  const changePercent = previous?.close && Number.isFinite(previous.close)
    ? ((price - previous.close) / previous.close) * 100
    : null;
  const sourcePrices = (intradayHistory?.candles ?? [])
    .map(candle => candle.close)
    .filter(Number.isFinite)
    .slice(range === "day" ? -24 : -7);
  // اجعل آخر نقطة مطابقة للسعر المعروض عندما يكون السعر اللحظي أحدث من آخر شمعة.
  const sparklinePrices = sourcePrices.length
    ? [...sourcePrices.slice(0, -1), price]
    : [];

  return {
    symbol: metal.symbol,
    label: metal.label,
    shortLabel: metal.shortLabel,
    price,
    changePercent: Number.isFinite(changePercent) ? changePercent : null,
    sparklinePrices,
    sparklineRange: range,
    currency: history.currency || "USD",
    precision: metal.precision,
  };
}

async function fetchPreciousMetals(range: SparklineRange) {
  const results = await Promise.allSettled(
    PRECIOUS_METALS.map(async metal => {
      const [dailyHistory, sparklineHistory] = await Promise.all([
        getCandleHistoryCached(metal.yahooSymbol, "OZ", "1d", "5d"),
        range === "day"
          ? getCandleHistoryCached(metal.yahooSymbol, "OZ", "60m", "1d")
          : getCandleHistoryCached(metal.yahooSymbol, "OZ", "1d", "1mo"),
      ]);
      return toPreciousMetalQuote(metal, dailyHistory, sparklineHistory, range);
    }),
  );
  const items = results.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
  if (!items.length) throw new Error("تعذّر جلب أسعار المعادن الثمينة من مزود السوق");
  return { items, fetchedAt: new Date().toISOString() };
}

async function fetchCorrelationMatrix() {
  const loaded = await Promise.allSettled(CORRELATION_ASSETS.map(async asset => ({ asset, history: await getCandleHistoryCached(asset.symbol, asset.exchange, "1d", "6mo", 180) })));
  const histories = loaded.flatMap(item => item.status === "fulfilled" ? [item.value] : []);
  const assets = histories.map(item => ({ id: item.asset.id, label: item.asset.label }));
  const matrix = histories.map(left => ({
    id: left.asset.id,
    values: histories.map(right => left.asset.id === right.asset.id ? 1 : correlationFromCandles(left.history.candles, right.history.candles).value),
  }));
  return { assets, matrix, fetchedAt: new Date().toISOString() };
}

const marketCacheCoalescer = createInFlightRequestCoalescer();

export async function cached<T>(
  cacheKey: string,
  market: string,
  exchange: string,
  selectedTimeframe: string,
  seconds: number,
  load: () => Promise<T>,
) {
  const existing = await getMarketSnapshot(cacheKey);
  if (existing) return existing as T;
  return marketCacheCoalescer.run(cacheKey, async () => {
    const result = await load();
    await saveMarketSnapshot({
      cacheKey,
      market,
      exchange,
      timeframe: selectedTimeframe,
      payload: result,
      expiresAt: new Date(Date.now() + seconds * 1000),
    });
    return result;
  });
}

export const marketRouter = router({
  availableTools: protectedProcedure.query(() => listTradingViewTools()),

  liveQuote: protectedProcedure
    .input(z.object({ symbol: z.string().min(1).max(32), exchange: z.string().min(1).max(32) }))
    .query(({ input }) => getTwelveDataLiveQuote(input.symbol, input.exchange)),

  preciousMetals: publicProcedure
    .input(z.object({ range: sparklineRange.optional() }).optional())
    .query(({ input }) => {
      const range = input?.range ?? "day";
      return cached(`widget:precious-metals:v3:${range}`, "metals", "OZ", range, 60, () => fetchPreciousMetals(range));
    }),

  correlationMatrix: publicProcedure.query(() =>
    cached("market:correlation-matrix:v1", "correlation", "MULTI", "1D", 60 * 60, fetchCorrelationMatrix),
  ),

  overviewSlice: publicProcedure
    .input(z.enum(["cryptoGainers", "cryptoLosers", "stockGainers", "stockLosers", "globalSnapshot"]))
    .query(({ input }) =>
      cached(`overview:${input}:1D`, "global", "MULTI", "1D", 300, () => {
        if (input === "cryptoGainers") return callTradingViewTool("top_gainers", { exchange: "BINANCE", timeframe: "1D", limit: 6 });
        if (input === "cryptoLosers") return callTradingViewTool("top_losers", { exchange: "BINANCE", timeframe: "1D", limit: 6 });
        if (input === "stockGainers") return callTradingViewTool("top_gainers", { exchange: "NASDAQ", timeframe: "1D", limit: 6 });
        if (input === "stockLosers") return callTradingViewTool("top_losers", { exchange: "NASDAQ", timeframe: "1D", limit: 6 });
        return callTradingViewTool("market_snapshot", {});
      }),
    ),

  overview: publicProcedure.query(async () =>
    cached("overview:global:1D", "global", "MULTI", "1D", 60, async () => {
      const [cryptoGainers, cryptoLosers, stockGainers, stockLosers, globalSnapshot] = await Promise.all([
        callTradingViewTool("top_gainers", { exchange: "BINANCE", timeframe: "1D", limit: 6 }),
        callTradingViewTool("top_losers", { exchange: "BINANCE", timeframe: "1D", limit: 6 }),
        callTradingViewTool("top_gainers", { exchange: "NASDAQ", timeframe: "1D", limit: 6 }),
        callTradingViewTool("top_losers", { exchange: "NASDAQ", timeframe: "1D", limit: 6 }),
        callTradingViewTool("market_snapshot", {}),
      ]);
      return { cryptoGainers, cryptoLosers, stockGainers, stockLosers, globalSnapshot, fetchedAt: new Date().toISOString() };
    }),
  ),

  analysis: publicProcedure
    .input(z.object({ symbol: z.string().min(1).max(32), exchange: z.string().min(1).max(32), timeframe }))
    .query(({ input }) =>
      cached(
        `analysis:v2:${input.exchange}:${input.symbol}:${input.timeframe}`,
        "analysis",
        input.exchange,
        input.timeframe,
        45,
        async () => normalizeTechnicalAnalysis(await callTradingViewTool("coin_analysis", input), input),
      ),
    ),

  multiTimeframe: publicProcedure
    .input(z.object({ symbol: z.string().min(1).max(32), exchange: z.string().min(1).max(32) }))
    .query(({ input }) =>
      cached(
        `multi:v2:${input.exchange}:${input.symbol}`,
        "analysis",
        input.exchange,
        "MULTI",
        90,
        async () => normalizeMultiTimeframeAnalysis(await callTradingViewTool("multi_timeframe_analysis", input), input),
      ),
    ),

  screener: publicProcedure
    .input(
      z.object({
        exchange: z.string().min(1).max(32).default("BINANCE"),
        timeframe: timeframe.default("1h"),
        rating: z.number().int().min(-3).max(3).optional(),
        limit: z.number().int().min(1).max(50).default(20),
      }),
    )
    .query(({ input }) =>
      input.rating === undefined
        ? callTradingViewTool("top_gainers", input)
        : callTradingViewTool("rating_filter", { ...input, rating: input.rating }),
    ),

  callTool: protectedProcedure
    .input(z.object({ name: toolName, args: z.record(z.string(), z.unknown()).default({}) }))
    .mutation(({ input }) => callTradingViewTool(input.name, input.args)),

  // بيانات الشموع تاريخية عامة ومخزنة مؤقتاً؛ لا ينبغي أن يمنع غياب الجلسة عرض مخطط صفحة التحليل العامة.
  candles: publicProcedure
    .input(
      z.object({
        symbol: z.string().min(1).max(32),
        exchange: z.string().min(1).max(32),
        interval: candleInterval.default("1d"),
        range: candleRange.optional(),
        limit: z.number().int().min(120).max(600).optional(),
        before: z.number().int().positive().optional(),
      }),
    )
    .query(({ input }) =>
      getCandleHistoryCached(input.symbol, input.exchange, input.interval, input.range ?? intervalToRange(input.interval), input.limit, { before: input.before }),
    ),

  chartPreferences: router({
    get: protectedProcedure.query(async ({ ctx }) => {
      const preferences = await getUserChartPreferences(ctx.user.id);
      return normalizeChartPreferences(preferences?.layers ?? DEFAULT_CHART_PREFERENCES);
    }),
    save: protectedProcedure
      .input(chartPreferencesInput)
      .mutation(({ ctx, input }) => saveUserChartPreferences(ctx.user.id, input)),
  }),
});

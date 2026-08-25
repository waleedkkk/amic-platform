import { z } from "zod";
import { getCandleHistoryCached, type CandleHistory, type CandleInterval } from "../candles";
import { addUserWatchlistItem, getMarketSnapshot, getUserAnalysisExternalContextPreferences, getUserChartPreferences, getUserMarketPulsePreferences, listUserWatchlist, removeUserWatchlistItem, saveMarketSnapshot, saveUserAnalysisExternalContextPreferences, saveUserChartPreferences, saveUserMarketPulsePreferences } from "../db";
import { createInFlightRequestCoalescer } from "../cacheCoalescing";
import { callTradingViewTool, isTradingViewMcpAvailabilityError, listTradingViewTools, TRADINGVIEW_TOOL_NAMES } from "../mcpClient";
import { deriveTechnicalAnalysisFromCandles } from "../candleTechnicalFallback";
import { getTwelveDataLiveQuote } from "../twelveDataStream";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";
import { DEFAULT_CHART_PREFERENCES, chartLayerColorKeys, chartLayerOpacityKeys, normalizeChartPreferences } from "../../shared/chartPreferences";
import { normalizeMultiTimeframeAnalysis, normalizeTechnicalAnalysis } from "../technicalAnalysis";
import { fetchCorrelationContext } from "../correlationContext";
import { correlationFromCandles } from "../../shared/correlation";
import { DEFAULT_MARKET_PULSE_PREFERENCES, MARKET_PULSE_SECTION_KEYS, MARKET_PULSE_WIDGET_KEYS, normalizeMarketPulsePreferences, normalizeMarketPulseSections } from "../../shared/marketPulsePreferences";
import { calculateConfluenceIct, type IndicatorCandle } from "../../shared/confluenceIct";
import { calculateUnifiedDecision } from "../../shared/unifiedDecision";
import { MAX_EXTERNAL_CONTEXT_REFERENCES, normalizeExternalContextReferences } from "../../shared/analysisExternalContext";

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
  layerStyles: z.object({
    colors: z.object(Object.fromEntries(chartLayerColorKeys.map(key => [key, z.string().regex(/^#[\da-fA-F]{6}$/)])) as Record<(typeof chartLayerColorKeys)[number], z.ZodString>),
    opacity: z.object(Object.fromEntries(chartLayerOpacityKeys.map(key => [key, z.number().min(0.15).max(1)])) as Record<(typeof chartLayerOpacityKeys)[number], z.ZodNumber>),
  }),
  priceScaleMode: z.enum(["normal", "logarithmic"]),
});
const marketPulseSectionsInput = z.object({ sections: z.array(z.enum(MARKET_PULSE_SECTION_KEYS)).min(1).max(MARKET_PULSE_SECTION_KEYS.length) });
const marketPulsePreferencesInput = marketPulseSectionsInput.extend({
  widgets: z.array(z.enum(MARKET_PULSE_WIDGET_KEYS)).max(MARKET_PULSE_WIDGET_KEYS.length),
});
const marketPulseSymbolInput = z.object({
  symbol: z.string().trim().min(1).max(32).transform(value => value.toUpperCase()),
  exchange: z.string().trim().min(1).max(32).transform(value => value.toUpperCase()),
});
const externalContextReferencesInput = z.object({ references: z.array(marketPulseSymbolInput).max(MAX_EXTERNAL_CONTEXT_REFERENCES) });
export type SparklineRange = z.infer<typeof sparklineRange>;
type MarketOverviewSliceResponse =
  | { kind: "slice"; items: unknown; fetchedAt: string; source: string; market: string; direction: "gainers" | "losers" }
  | { kind: "snapshot"; data: unknown; fetchedAt: string; source: string };
const marketOverviewSlice = z.enum(["cryptoGainers", "cryptoLosers", "stockGainers", "stockLosers", "globalSnapshot"]);
type MarketOverviewSliceKey = z.infer<typeof marketOverviewSlice>;

async function loadMarketOverviewSlice(input: MarketOverviewSliceKey): Promise<MarketOverviewSliceResponse> {
  const fetchedAt = new Date().toISOString();
  if (input === "cryptoGainers") return { kind: "slice", items: await callTradingViewTool("top_gainers", { exchange: "BINANCE", timeframe: "1D", limit: 6 }), fetchedAt, source: "TradingView MCP", market: "BINANCE", direction: "gainers" };
  if (input === "cryptoLosers") return { kind: "slice", items: await callTradingViewTool("top_losers", { exchange: "BINANCE", timeframe: "1D", limit: 6 }), fetchedAt, source: "TradingView MCP", market: "BINANCE", direction: "losers" };
  if (input === "stockGainers") return { kind: "slice", items: await callTradingViewTool("top_gainers", { exchange: "NASDAQ", timeframe: "1D", limit: 6 }), fetchedAt, source: "TradingView MCP", market: "NASDAQ", direction: "gainers" };
  if (input === "stockLosers") return { kind: "slice", items: await callTradingViewTool("top_losers", { exchange: "NASDAQ", timeframe: "1D", limit: 6 }), fetchedAt, source: "TradingView MCP", market: "NASDAQ", direction: "losers" };
  return { kind: "snapshot", data: await callTradingViewTool("market_snapshot", {}), fetchedAt, source: "TradingView MCP" };
}

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

function technicalTimeframeToCandleInterval(value: z.infer<typeof timeframe>): CandleInterval {
  if (value === "1D") return "1d";
  if (value === "1W") return "1wk";
  if (value === "1M") return "1mo";
  if (value === "1h") return "60m";
  return value;
}

async function fetchTechnicalAnalysisWithFallback(input: { symbol: string; exchange: string; timeframe: z.infer<typeof timeframe> }) {
  let analysis;
  try {
    analysis = normalizeTechnicalAnalysis(await callTradingViewTool("coin_analysis", input), input);
  } catch (error) {
    if (!isTradingViewMcpAvailabilityError(error)) throw error;
    const interval = technicalTimeframeToCandleInterval(input.timeframe);
    const history = await getCandleHistoryCached(input.symbol, input.exchange, interval, intervalToRange(interval), 250);
    analysis = deriveTechnicalAnalysisFromCandles(history, input);
  }
  if (analysis.source === "candle-history") return analysis;
  const correlationContext = await fetchCorrelationContext(input, analysis.price.changePercent).catch(error => {
    console.warn("[CorrelationContext] Context was unavailable without affecting core analysis", { reason: error instanceof Error ? error.message.slice(0, 240) : "سبب غير متاح" });
    return undefined;
  });
  return { ...analysis, correlationContext };
}

function inferWatchlistAssetClass(symbol: string, exchange: string): "crypto" | "stock" | "forex" | "futures" {
  if (exchange === "BINANCE" || symbol.endsWith("USDT")) return "crypto";
  if (["NASDAQ", "NYSE", "AMEX", "SSE"].includes(exchange)) return "stock";
  if (/^(XAU|XAG)/.test(symbol)) return "futures";
  return "forex";
}

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

async function fetchExternalContextCards(current: { symbol: string; exchange: string }, references: Array<{ symbol: string; exchange: string }>) {
  const currentHistory = await getCandleHistoryCached(current.symbol, current.exchange, "1d", "6mo", 180);
  const loaded = await Promise.allSettled(references.map(async reference => ({ reference, history: await getCandleHistoryCached(reference.symbol, reference.exchange, "1d", "6mo", 180) })));
  const cards = loaded.flatMap(item => {
    if (item.status !== "fulfilled") return [];
    const { reference, history } = item.value;
    const latest = history.candles.at(-1);
    const previous = history.candles.at(-2);
    if (!latest) return [];
    const price = history.regularMarketPrice ?? latest.close;
    const changePercent = previous?.close ? ((price - previous.close) / previous.close) * 100 : null;
    const correlation = correlationFromCandles(currentHistory.candles, history.candles);
    return [{ ...reference, price, changePercent: Number.isFinite(changePercent) ? changePercent : null, correlation: correlation.value, sampleSize: correlation.sampleSize, fetchedAt: history.fetchedAt, provider: history.provider ?? null }];
  });
  return { current, cards, fetchedAt: new Date().toISOString() };
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
    .input(marketOverviewSlice)
    .query(({ input }) =>
      cached<MarketOverviewSliceResponse>(`overview:v2:${input}:1D`, "global", "MULTI", "1D", 300, () => loadMarketOverviewSlice(input)),
    ),

  refreshOverviewSlice: publicProcedure
    .input(marketOverviewSlice)
    .mutation(async ({ input }) => {
      const result = await loadMarketOverviewSlice(input);
      await saveMarketSnapshot({
        cacheKey: `overview:v2:${input}:1D`,
        market: "global",
        exchange: "MULTI",
        timeframe: "1D",
        payload: result,
        expiresAt: new Date(Date.now() + 300_000),
      });
      return result;
    }),

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
        () => fetchTechnicalAnalysisWithFallback(input),
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

  decisionSummary: publicProcedure
    .input(z.object({ symbol: z.string().min(1).max(32), exchange: z.string().min(1).max(32), timeframe }))
    .query(({ input }) =>
      cached(
        `decision-summary:v1:${input.exchange}:${input.symbol}:${input.timeframe}`,
        "analysis-decision",
        input.exchange,
        input.timeframe,
        45,
        async () => {
          const interval = technicalTimeframeToCandleInterval(input.timeframe);
          const [core, history, timeframes] = await Promise.all([
            fetchTechnicalAnalysisWithFallback(input),
            getCandleHistoryCached(input.symbol, input.exchange, interval, intervalToRange(interval), 250),
            Promise.resolve()
              .then(() => callTradingViewTool("multi_timeframe_analysis", input))
              .then(raw => normalizeMultiTimeframeAnalysis(raw, input))
              .catch((error: unknown) => {
                console.warn("[UnifiedDecision] Multi-timeframe context unavailable", { reason: error instanceof Error ? error.message.slice(0, 240) : "سبب غير متاح" });
                return null;
              }),
          ]);
          const candles: IndicatorCandle[] = history.candles.map((candle: CandleHistory["candles"][number]) => ({
            time: candle.time,
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
          }));
          const ict = calculateConfluenceIct(candles);
          return calculateUnifiedDecision({
            core,
            ict,
            timeframes,
            correlation: core.correlationContext,
          });
        },
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

  pulse: router({
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const [preferences, watchlist] = await Promise.all([getUserMarketPulsePreferences(ctx.user.id), listUserWatchlist(ctx.user.id)]);
      return {
        ...normalizeMarketPulsePreferences(preferences?.sections ?? DEFAULT_MARKET_PULSE_PREFERENCES),
        watchlist,
      };
    }),
    saveSections: protectedProcedure
      .input(marketPulseSectionsInput)
      .mutation(async ({ ctx, input }) => {
        const current = await getUserMarketPulsePreferences(ctx.user.id);
        const preferences = normalizeMarketPulsePreferences(current?.sections ?? DEFAULT_MARKET_PULSE_PREFERENCES);
        const next = { ...preferences, sections: normalizeMarketPulseSections(input.sections) };
        return saveUserMarketPulsePreferences(ctx.user.id, next);
      }),
    savePreferences: protectedProcedure
      .input(marketPulsePreferencesInput)
      .mutation(({ ctx, input }) => {
        const preferences = normalizeMarketPulsePreferences(input);
        return saveUserMarketPulsePreferences(ctx.user.id, preferences);
      }),
    addSymbol: protectedProcedure
      .input(marketPulseSymbolInput)
      .mutation(async ({ ctx, input }) => {
        const existing = await listUserWatchlist(ctx.user.id);
        const alreadySaved = existing.some(item => item.symbol === input.symbol && item.exchange === input.exchange);
        if (!alreadySaved && existing.length >= 8) throw new Error("يمكن حفظ ثمانية رموز كحد أقصى في نبض السوق.");
        return addUserWatchlistItem(ctx.user.id, { ...input, assetClass: inferWatchlistAssetClass(input.symbol, input.exchange) });
      }),
    removeSymbol: protectedProcedure
      .input(marketPulseSymbolInput)
      .mutation(({ ctx, input }) => removeUserWatchlistItem(ctx.user.id, input.symbol, input.exchange)),
    watchlistQuotes: protectedProcedure.query(async ({ ctx }) => {
      const watchlist = (await listUserWatchlist(ctx.user.id)).slice(0, 8);
      const loaded = await Promise.allSettled(watchlist.map(async item => {
        const analysis = await cached(
          `pulse:watchlist:${item.exchange}:${item.symbol}:1h`,
          "pulse-watchlist",
          item.exchange,
          "1h",
          45,
          async () => normalizeTechnicalAnalysis(await callTradingViewTool("coin_analysis", { symbol: item.symbol, exchange: item.exchange, timeframe: "1h" }), { symbol: item.symbol, exchange: item.exchange, timeframe: "1h" }),
        );
        return { symbol: item.symbol, exchange: item.exchange, assetClass: item.assetClass, price: analysis.price.current ?? analysis.price.close ?? null, changePercent: analysis.price.changePercent ?? null, recommendation: analysis.recommendation.signal ?? "neutral", source: analysis.source ?? "TradingView MCP", fetchedAt: new Date().toISOString(), error: null };
      }));
      return loaded.map((result, index) => {
        if (result.status === "fulfilled") return result.value;
        const item = watchlist[index];
        return {
          symbol: item.symbol,
          exchange: item.exchange,
          assetClass: item.assetClass,
          price: null,
          changePercent: null,
          recommendation: "neutral",
          source: null,
          fetchedAt: null,
          error: "تعذّر تحديث هذا الرمز الآن؛ بقية القائمة ما زالت متاحة.",
        };
      });
    }),
  }),

  externalContext: router({
    getPreferences: protectedProcedure.query(async ({ ctx }) => {
      const preferences = await getUserAnalysisExternalContextPreferences(ctx.user.id);
      return { references: normalizeExternalContextReferences(preferences?.references ?? []) };
    }),
    savePreferences: protectedProcedure
      .input(externalContextReferencesInput)
      .mutation(async ({ ctx, input }) => {
        const references = normalizeExternalContextReferences(input.references);
        return saveUserAnalysisExternalContextPreferences(ctx.user.id, references);
      }),
    cards: protectedProcedure
      .input(marketPulseSymbolInput)
      .query(async ({ ctx, input }) => {
        const preferences = await getUserAnalysisExternalContextPreferences(ctx.user.id);
        const references = normalizeExternalContextReferences(preferences?.references ?? []).filter(reference => !(reference.symbol === input.symbol && reference.exchange === input.exchange));
        const refsKey = references.map(reference => `${reference.exchange}:${reference.symbol}`).join(",") || "none";
        return cached(`analysis:external-context:${input.exchange}:${input.symbol}:${refsKey}`, "external-context", input.exchange, "1d", 90, () => fetchExternalContextCards(input, references));
      }),
  }),
});

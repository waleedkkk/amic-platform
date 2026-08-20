import { z } from "zod";
import { getMarketSnapshot, saveMarketSnapshot } from "../db";
import { callTradingViewTool, listTradingViewTools, TRADINGVIEW_TOOL_NAMES } from "../mcpClient";
import { protectedProcedure, publicProcedure, router } from "../_core/trpc";

const timeframe = z.enum(["5m", "15m", "1h", "4h", "1D", "1W", "1M"]);
const toolName = z.enum(TRADINGVIEW_TOOL_NAMES);

async function cached<T>(
  cacheKey: string,
  market: string,
  exchange: string,
  selectedTimeframe: string,
  seconds: number,
  load: () => Promise<T>,
) {
  const existing = await getMarketSnapshot(cacheKey);
  if (existing) return existing as T;
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
}

export const marketRouter = router({
  availableTools: protectedProcedure.query(() => listTradingViewTools()),

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
        `analysis:${input.exchange}:${input.symbol}:${input.timeframe}`,
        "analysis",
        input.exchange,
        input.timeframe,
        45,
        () => callTradingViewTool("coin_analysis", input),
      ),
    ),

  multiTimeframe: publicProcedure
    .input(z.object({ symbol: z.string().min(1).max(32), exchange: z.string().min(1).max(32) }))
    .query(({ input }) =>
      cached(
        `multi:${input.exchange}:${input.symbol}`,
        "analysis",
        input.exchange,
        "MULTI",
        90,
        () => callTradingViewTool("multi_timeframe_analysis", input),
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
});

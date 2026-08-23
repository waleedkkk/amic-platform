import { z } from "zod";
import { callTradingViewTool } from "../mcpClient";
import { protectedProcedure, router } from "../_core/trpc";
import { BACKTEST_INTERVALS, BACKTEST_PERIODS, BACKTEST_STRATEGIES, normalizeBacktestResult } from "../../shared/backtest";

const baseInput = z.object({
  symbol: z.string().trim().min(1).max(32).regex(/^[A-Za-z0-9.^=\-]+$/, "أدخل رمز Yahoo Finance صالحًا مثل BTC-USD أو AAPL."),
  period: z.enum(BACKTEST_PERIODS),
  initialCapital: z.number().finite().positive().max(10_000_000),
  interval: z.enum(BACKTEST_INTERVALS),
});

export const backtestRouter = router({
  run: protectedProcedure.input(baseInput.extend({ strategy: z.enum(BACKTEST_STRATEGIES), commissionPct: z.number().finite().min(0).max(100), slippagePct: z.number().finite().min(0).max(100) })).mutation(async ({ input }) => normalizeBacktestResult(await callTradingViewTool("backtest_strategy", { symbol: input.symbol, strategy: input.strategy, period: input.period, initial_capital: input.initialCapital, commission_pct: input.commissionPct, slippage_pct: input.slippagePct, interval: input.interval, include_trade_log: true, include_equity_curve: true }))),
  compare: protectedProcedure.input(baseInput).mutation(async ({ input }) => normalizeBacktestResult(await callTradingViewTool("compare_strategies", { symbol: input.symbol, period: input.period, initial_capital: input.initialCapital, interval: input.interval }))),
  walkForward: protectedProcedure.input(baseInput.extend({ strategy: z.enum(BACKTEST_STRATEGIES), commissionPct: z.number().finite().min(0).max(100), slippagePct: z.number().finite().min(0).max(100) })).mutation(async ({ input }) => normalizeBacktestResult(await callTradingViewTool("walk_forward_backtest_strategy", { symbol: input.symbol, strategy: input.strategy, period: input.period === "2y" ? "2y" : "1y", initial_capital: input.initialCapital, commission_pct: input.commissionPct, slippage_pct: input.slippagePct, n_splits: 3, train_ratio: 0.7, interval: input.interval }))),
});

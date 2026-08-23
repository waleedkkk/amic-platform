export const BACKTEST_STRATEGIES = ["rsi", "bollinger", "macd", "ema_cross", "supertrend", "donchian", "rsi_pullback", "keltner_breakout", "triple_ema"] as const;
export const BACKTEST_PERIODS = ["1mo", "3mo", "6mo", "1y", "2y"] as const;
export const BACKTEST_INTERVALS = ["1d", "1h"] as const;

export type BacktestResult = Record<string, unknown> & { error?: string | { message?: string; code?: string } };

export function normalizeBacktestResult(result: unknown): BacktestResult {
  if (!result || typeof result !== "object" || Array.isArray(result)) return { error: "استجابة اختبار الاستراتيجية غير صالحة من مزود البيانات." };
  return result as BacktestResult;
}

export function backtestErrorMessage(result?: BacktestResult) {
  if (!result?.error) return null;
  return typeof result.error === "string" ? result.error : result.error.message ?? result.error.code ?? "تعذّر تنفيذ اختبار الاستراتيجية.";
}

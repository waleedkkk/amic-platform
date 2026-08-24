import type { Candle, CandleHistory } from "./candles";
import type { TechnicalAnalysis } from "../shared/technicalAnalysis";

type AnalysisRequest = { symbol: string; exchange: string; timeframe: string };

function last<T>(values: T[]): T | null {
  return values.length ? values[values.length - 1] ?? null : null;
}

function finite(value: number | null | undefined): number | null {
  return value !== null && value !== undefined && Number.isFinite(value) ? value : null;
}

function sma(values: number[], period: number): Array<number | null> {
  return values.map((_, index) => {
    if (index + 1 < period) return null;
    const window = values.slice(index - period + 1, index + 1);
    return window.reduce((sum, value) => sum + value, 0) / period;
  });
}

function ema(values: number[], period: number): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length < period) return result;
  const seed = values.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = seed;
  const multiplier = 2 / (period + 1);
  let current = seed;
  for (let index = period; index < values.length; index += 1) {
    current = (values[index] - current) * multiplier + current;
    result[index] = current;
  }
  return result;
}

function rsi(values: number[], period = 14): Array<number | null> {
  const result: Array<number | null> = Array(values.length).fill(null);
  if (values.length <= period) return result;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const change = values[index] - values[index - 1];
    gains += Math.max(change, 0);
    losses += Math.max(-change, 0);
  }
  let averageGain = gains / period;
  let averageLoss = losses / period;
  const calculate = () => averageLoss === 0 ? 100 : 100 - 100 / (1 + averageGain / averageLoss);
  result[period] = calculate();
  for (let index = period + 1; index < values.length; index += 1) {
    const change = values[index] - values[index - 1];
    averageGain = (averageGain * (period - 1) + Math.max(change, 0)) / period;
    averageLoss = (averageLoss * (period - 1) + Math.max(-change, 0)) / period;
    result[index] = calculate();
  }
  return result;
}

function atr(candles: Candle[], period = 14): Array<number | null> {
  const ranges = candles.map((candle, index) => index === 0
    ? candle.high - candle.low
    : Math.max(candle.high - candle.low, Math.abs(candle.high - candles[index - 1].close), Math.abs(candle.low - candles[index - 1].close)));
  const result: Array<number | null> = Array(candles.length).fill(null);
  if (ranges.length < period) return result;
  let current = ranges.slice(0, period).reduce((sum, value) => sum + value, 0) / period;
  result[period - 1] = current;
  for (let index = period; index < ranges.length; index += 1) {
    current = (current * (period - 1) + ranges[index]) / period;
    result[index] = current;
  }
  return result;
}

function rollingStochastic(candles: Candle[], period = 14): Array<number | null> {
  return candles.map((candle, index) => {
    if (index + 1 < period) return null;
    const window = candles.slice(index - period + 1, index + 1);
    const high = Math.max(...window.map(item => item.high));
    const low = Math.min(...window.map(item => item.low));
    return high === low ? 50 : ((candle.close - low) / (high - low)) * 100;
  });
}

function latest(values: Array<number | null>): number | null {
  for (let index = values.length - 1; index >= 0; index -= 1) {
    const value = values[index];
    if (value !== null && Number.isFinite(value)) return value;
  }
  return null;
}

function fallbackLevels(candles: Candle[]): TechnicalAnalysis["levels"] {
  const sample = candles.slice(-55);
  const current = last(sample)?.close ?? null;
  if (!sample.length || current === null) return { pivot: null, supports: [], resistances: [], nearestSupport: null, nearestResistance: null };
  const high = Math.max(...sample.map(candle => candle.high));
  const low = Math.min(...sample.map(candle => candle.low));
  const pivot = (high + low + current) / 3;
  const support = Math.min(...sample.map(candle => candle.low));
  const resistance = Math.max(...sample.map(candle => candle.high));
  return { pivot, supports: support < current ? [support] : [], resistances: resistance > current ? [resistance] : [], nearestSupport: support < current ? support : null, nearestResistance: resistance > current ? resistance : null };
}

/**
 * احتياط محدود وشفاف: يحسب مؤشرات وصفية من الشموع المتاحة فقط.
 * لا ينتج توصية دخول ولا يدّعي أنه بديل مكافئ لتحليل TradingView MCP.
 */
export function deriveTechnicalAnalysisFromCandles(history: CandleHistory, request: AnalysisRequest): TechnicalAnalysis {
  const candles = history.candles.filter(candle => [candle.open, candle.high, candle.low, candle.close, candle.volume].every(Number.isFinite));
  if (candles.length < 2) throw new Error("لا يتوفر تاريخ شموع كافٍ لبناء الاحتياط التحليلي.");
  const closes = candles.map(candle => candle.close);
  const currentCandle = last(candles)!;
  const previousCandle = candles[candles.length - 2]!;
  const currentPrice = finite(history.regularMarketPrice) ?? currentCandle.close;
  const priceChange = previousCandle.close === 0 ? null : ((currentPrice - previousCandle.close) / previousCandle.close) * 100;
  const smaValues = Object.fromEntries([9, 10, 20, 30, 50, 100, 200].map(period => [`sma${period}`, latest(sma(closes, period))]));
  const emaValues = Object.fromEntries([9, 10, 20, 30, 50, 100, 200].map(period => [`ema${period}`, latest(ema(closes, period))]));
  const rsiValues = rsi(closes);
  const rsiCurrent = latest(rsiValues);
  const rsiPrevious = rsiValues.length > 1 ? rsiValues[rsiValues.length - 2] : null;
  const ema12 = ema(closes, 12);
  const ema26 = ema(closes, 26);
  const macdLineSeries = closes.map((_, index) => ema12[index] !== null && ema26[index] !== null ? ema12[index]! - ema26[index]! : null);
  const compactMacd = macdLineSeries.map(value => value ?? 0);
  const macdSignalSeries = ema(compactMacd, 9);
  const macdLine = latest(macdLineSeries);
  const macdSignal = latest(macdSignalSeries);
  const macdHistogram = macdLine !== null && macdSignal !== null ? macdLine - macdSignal : null;
  const bollingerWindow = closes.slice(-20);
  const bollingerMiddle = bollingerWindow.length === 20 ? bollingerWindow.reduce((sum, value) => sum + value, 0) / 20 : null;
  const deviation = bollingerMiddle === null ? null : Math.sqrt(bollingerWindow.reduce((sum, value) => sum + (value - bollingerMiddle) ** 2, 0) / 20);
  const bollingerUpper = bollingerMiddle !== null && deviation !== null ? bollingerMiddle + deviation * 2 : null;
  const bollingerLower = bollingerMiddle !== null && deviation !== null ? bollingerMiddle - deviation * 2 : null;
  const atrCurrent = latest(atr(candles));
  const stochasticK = rollingStochastic(candles);
  const stochasticCurrent = latest(stochasticK);
  const stochasticD = latest(sma(stochasticK.map(value => value ?? 50), 3));
  const ema20 = emaValues.ema20;
  const ema50 = emaValues.ema50;
  const trend = ema20 === null || ema50 === null ? null : ema20 > ema50 ? "bullish" : ema20 < ema50 ? "bearish" : "neutral";
  const momentumAligned = trend === "bullish" ? (rsiCurrent !== null && rsiCurrent >= 50 && (macdHistogram ?? 0) >= 0) : trend === "bearish" ? (rsiCurrent !== null && rsiCurrent <= 50 && (macdHistogram ?? 0) <= 0) : null;

  return {
    schemaVersion: 1,
    source: "candle-history",
    fetchedAt: history.fetchedAt,
    sourceTimestamp: history.fetchedAt,
    symbol: request.symbol.toUpperCase(),
    exchange: request.exchange.toUpperCase(),
    timeframe: request.timeframe,
    price: { current: currentPrice, open: currentCandle.open, high: currentCandle.high, low: currentCandle.low, close: currentCandle.close, changePercent: priceChange, volume: currentCandle.volume },
    recommendation: { signal: "neutral", confidence: null },
    indicators: {
      rsi: { value: rsiCurrent, signal: rsiCurrent === null ? null : rsiCurrent >= 70 ? "overbought" : rsiCurrent <= 30 ? "oversold" : "neutral", direction: rsiCurrent === null || rsiPrevious === null ? null : rsiCurrent > rsiPrevious ? "rising" : rsiCurrent < rsiPrevious ? "falling" : "flat", previous: rsiPrevious },
      macd: { line: macdLine, signal: macdSignal, histogram: macdHistogram, crossover: macdHistogram === null ? null : macdHistogram >= 0 ? "bullish" : "bearish" },
      bollinger: { upper: bollingerUpper, middle: bollingerMiddle, lower: bollingerLower, width: bollingerUpper !== null && bollingerLower !== null && bollingerMiddle ? (bollingerUpper - bollingerLower) / bollingerMiddle : null, squeeze: null, position: bollingerUpper !== null && bollingerLower !== null ? currentPrice >= bollingerUpper ? "upper" : currentPrice <= bollingerLower ? "lower" : "middle" : null },
      atr: { value: atrCurrent, percentOfPrice: atrCurrent !== null && currentPrice > 0 ? (atrCurrent / currentPrice) * 100 : null, volatility: null },
      stochastic: { k: stochasticCurrent, d: stochasticD, signal: stochasticCurrent === null || stochasticD === null ? null : stochasticCurrent > stochasticD ? "bullish" : "bearish" },
      adx: { value: null, trendStrength: null, plusDi: null, minusDi: null, signal: null },
      movingAverages: { sma: smaValues, ema: emaValues },
    },
    levels: fallbackLevels(candles),
    marketStructure: { trend, strength: "candle-derived", momentumAligned },
  };
}

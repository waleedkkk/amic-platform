import type { MultiTimeframeAnalysis, MultiTimeframeFrame, TechnicalAnalysis, TechnicalSignal } from "../shared/technicalAnalysis";

type RecordValue = Record<string, unknown>;

function recordOf(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : {};
}

function normalizeKey(value: string) {
  return value.toLowerCase().replace(/[\s_-]/g, "");
}

function field(record: RecordValue, aliases: string[]): unknown {
  const wanted = new Set(aliases.map(normalizeKey));
  return Object.entries(record).find(([key]) => wanted.has(normalizeKey(key)))?.[1];
}

function nested(record: RecordValue, aliases: string[]): RecordValue {
  return recordOf(field(record, aliases));
}

function numeric(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function numberField(record: RecordValue, aliases: string[]): number | null {
  return numeric(field(record, aliases));
}

function stringField(record: RecordValue, aliases: string[]): string | null {
  const value = field(record, aliases);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function booleanField(record: RecordValue, aliases: string[]): boolean | null {
  const value = field(record, aliases);
  return typeof value === "boolean" ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string" && item.trim().length > 0) : [];
}

function positiveNumbers(values: Array<number | null>): number[] {
  return values.filter((value): value is number => value !== null && value > 0);
}

export function normalizeTechnicalSignal(value: unknown): TechnicalSignal {
  const normalized = String(value ?? "").toLowerCase().replace(/[\s_-]/g, "");
  if (!normalized) return null;
  if (normalized.includes("strongbuy")) return "strong_buy";
  if (normalized.includes("strongsell")) return "strong_sell";
  if (normalized.includes("buy") || normalized.includes("bullish") || normalized.includes("long")) return "buy";
  if (normalized.includes("sell") || normalized.includes("bearish") || normalized.includes("short")) return "sell";
  if (normalized.includes("neutral") || normalized.includes("sideways") || normalized.includes("hold") || normalized.includes("notrade") || normalized.includes("wait")) return "neutral";
  return null;
}

function movingAverageValues(record: RecordValue, prefix: "sma" | "ema") {
  const result: Record<string, number | null> = {};
  for (const period of [9, 10, 20, 30, 50, 100, 200]) {
    result[`${prefix}${period}`] = numberField(record, [`${prefix}${period}`, `${prefix}_${period}`]);
  }
  return result;
}

export function normalizeTechnicalAnalysis(raw: unknown, request: { symbol: string; exchange: string; timeframe: string }, fetchedAt = new Date().toISOString()): TechnicalAnalysis {
  const source = recordOf(raw);
  const priceData = nested(source, ["price_data", "priceData"]);
  const rsi = nested(source, ["rsi", "relative_strength_index"]);
  const macd = nested(source, ["macd"]);
  const bollinger = nested(source, ["bollinger_bands", "bollingerBands", "bollinger", "bb"]);
  const atr = nested(source, ["atr"]);
  const stochastic = nested(source, ["stochastic", "stoch"]);
  const adx = nested(source, ["adx"]);
  const sma = nested(source, ["sma", "simple_moving_averages"]);
  const ema = nested(source, ["ema", "exponential_moving_averages"]);
  const levels = nested(source, ["support_resistance", "supportResistance", "levels"]);
  const structure = nested(source, ["market_structure", "marketStructure"]);
  const sentiment = nested(source, ["market_sentiment", "marketSentiment"]);
  const recommendationRaw = field(source, ["recommendation", "rating", "signal"]) ?? field(sentiment, ["buy_sell_signal", "signal", "recommendation"]);
  const supports = positiveNumbers([
    numberField(levels, ["nearest_support", "nearestSupport"]),
    numberField(levels, ["support_1", "support1", "s1"]),
    numberField(levels, ["support_2", "support2", "s2"]),
    numberField(levels, ["support_3", "support3", "s3"]),
  ]);
  const resistances = positiveNumbers([
    numberField(levels, ["nearest_resistance", "nearestResistance"]),
    numberField(levels, ["resistance_1", "resistance1", "r1"]),
    numberField(levels, ["resistance_2", "resistance2", "r2"]),
    numberField(levels, ["resistance_3", "resistance3", "r3"]),
  ]);

  return {
    schemaVersion: 1,
    source: "tradingview-mcp",
    fetchedAt,
    sourceTimestamp: stringField(source, ["timestamp", "updated_at", "updatedAt"]),
    symbol: stringField(source, ["symbol", "ticker"]) ?? request.symbol.toUpperCase(),
    exchange: stringField(source, ["exchange", "market"]) ?? request.exchange.toUpperCase(),
    timeframe: stringField(source, ["timeframe", "interval"]) ?? request.timeframe,
    price: {
      current: numberField(priceData, ["current_price", "currentPrice", "price", "last", "close"]) ?? numberField(source, ["current_price", "currentPrice", "price", "last", "close"]),
      open: numberField(priceData, ["open"]),
      high: numberField(priceData, ["high"]),
      low: numberField(priceData, ["low"]),
      close: numberField(priceData, ["close"]) ?? numberField(source, ["close"]),
      changePercent: numberField(priceData, ["change_percent", "changePercent", "change_pct"]),
      volume: numberField(priceData, ["volume"]),
    },
    recommendation: {
      signal: normalizeTechnicalSignal(recommendationRaw),
      confidence: numberField(source, ["confidence", "confluence_score", "score"]),
    },
    indicators: {
      rsi: { value: numberField(rsi, ["value", "rsi", "current"]), signal: stringField(rsi, ["signal"]), direction: stringField(rsi, ["direction"]), previous: numberField(rsi, ["previous"]) },
      macd: { line: numberField(macd, ["macd_line", "macdLine", "line", "value"]), signal: numberField(macd, ["signal_line", "signalLine", "signal"]), histogram: numberField(macd, ["histogram"]), crossover: stringField(macd, ["crossover", "signal"]) },
      bollinger: { upper: numberField(bollinger, ["upper", "upper_band", "upperBand"]), middle: numberField(bollinger, ["middle", "basis", "middle_band", "middleBand"]), lower: numberField(bollinger, ["lower", "lower_band", "lowerBand"]), width: numberField(bollinger, ["width", "bbw"]), squeeze: booleanField(bollinger, ["squeeze"]), position: stringField(bollinger, ["position"]) },
      atr: { value: numberField(atr, ["value", "atr"]), percentOfPrice: numberField(atr, ["percent_of_price", "percentOfPrice"]), volatility: stringField(atr, ["volatility"]) },
      stochastic: { k: numberField(stochastic, ["k", "%k"]), d: numberField(stochastic, ["d", "%d"]), signal: stringField(stochastic, ["signal"]) },
      adx: { value: numberField(adx, ["value", "adx"]), trendStrength: stringField(adx, ["trend_strength", "trendStrength"]), plusDi: numberField(adx, ["plus_di", "plusDi"]), minusDi: numberField(adx, ["minus_di", "minusDi"]), signal: stringField(adx, ["di_signal", "signal"]) },
      movingAverages: { sma: movingAverageValues(sma, "sma"), ema: movingAverageValues(ema, "ema") },
    },
    levels: {
      pivot: numberField(levels, ["pivot"]),
      supports: Array.from(new Set(supports)),
      resistances: Array.from(new Set(resistances)),
      nearestSupport: numberField(levels, ["nearest_support", "nearestSupport"]),
      nearestResistance: numberField(levels, ["nearest_resistance", "nearestResistance"]),
    },
    marketStructure: { trend: stringField(structure, ["trend"]), strength: stringField(structure, ["trend_strength", "trendStrength"]), momentumAligned: booleanField(structure, ["momentum_aligned", "momentumAligned"]) },
  };
}

function normalizeFrame(timeframe: string, raw: unknown, score: number | null): MultiTimeframeFrame {
  const source = recordOf(raw);
  const rsi = nested(source, ["rsi"]);
  const ema = nested(source, ["ema_trend", "emaTrend"]);
  return {
    timeframe,
    label: stringField(source, ["label"]),
    bias: stringField(source, ["bias", "trend"]),
    score,
    price: numberField(source, ["price", "current_price", "currentPrice"]),
    changePercent: numberField(source, ["change_pct", "changePercent", "change_percent"]),
    rsi: numberField(rsi, ["value", "rsi"]),
    macdCrossover: stringField(source, ["macd_crossover", "macdCrossover"]),
    ema: { ema20: numberField(ema, ["ema20", "ema_20"]), ema50: numberField(ema, ["ema50", "ema_50"]), ema200: numberField(ema, ["ema200", "ema_200"]) },
    marketStructure: stringField(source, ["market_structure", "marketStructure"]),
    trendStrength: stringField(source, ["trend_strength", "trendStrength"]),
    momentumAligned: booleanField(source, ["momentum_aligned", "momentumAligned"]),
    advice: stringField(source, ["advice"]),
    keyIndicators: stringArray(field(source, ["key_indicators", "keyIndicators"])),
  };
}

export function normalizeMultiTimeframeAnalysis(raw: unknown, request: { symbol: string; exchange: string }, fetchedAt = new Date().toISOString()): MultiTimeframeAnalysis {
  const source = recordOf(raw);
  const rawFrames = nested(source, ["timeframes", "frames"]);
  const alignment = nested(source, ["alignment"]);
  const scores = nested(alignment, ["scores_by_tf", "scoresByTf"]);
  const recommendation = nested(source, ["recommendation"]);
  const frames = Object.fromEntries(Object.entries(rawFrames).map(([timeframe, frame]) => [timeframe, normalizeFrame(timeframe, frame, numberField(scores, [timeframe]))]));
  const supports = positiveNumbers([numberField(source, ["nearest_support", "nearestSupport"])]);
  const resistances = positiveNumbers([numberField(source, ["nearest_resistance", "nearestResistance"])]);
  const summary = stringField(recommendation, ["action", "summary"]);

  return {
    schemaVersion: 1,
    source: "tradingview-mcp",
    fetchedAt,
    symbol: stringField(source, ["symbol", "ticker"]) ?? request.symbol.toUpperCase(),
    exchange: stringField(source, ["exchange", "market"]) ?? request.exchange.toUpperCase(),
    frames,
    alignment: { status: stringField(alignment, ["status"]), confidence: stringField(alignment, ["confidence"]), netScore: numberField(alignment, ["net_score", "netScore"]), divergentTimeframes: stringArray(field(alignment, ["divergent_timeframes", "divergentTimeframes"])) },
    recommendation: { signal: normalizeTechnicalSignal(summary), summary, entryTimeframe: stringField(recommendation, ["entry_timeframe", "entryTimeframe"]), rules: stringArray(field(recommendation, ["rules"])) },
    levels: { supports, resistances },
  };
}

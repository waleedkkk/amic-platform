export type TechnicalSignal = "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" | null;

export type TechnicalAnalysis = {
  schemaVersion: 1;
  source: "tradingview-mcp";
  fetchedAt: string;
  sourceTimestamp: string | null;
  symbol: string;
  exchange: string;
  timeframe: string;
  price: {
    current: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    close: number | null;
    changePercent: number | null;
    volume: number | null;
  };
  recommendation: {
    signal: TechnicalSignal;
    confidence: number | null;
  };
  indicators: {
    rsi: { value: number | null; signal: string | null; direction: string | null; previous: number | null };
    macd: { line: number | null; signal: number | null; histogram: number | null; crossover: string | null };
    bollinger: { upper: number | null; middle: number | null; lower: number | null; width: number | null; squeeze: boolean | null; position: string | null };
    atr: { value: number | null; percentOfPrice: number | null; volatility: string | null };
    stochastic: { k: number | null; d: number | null; signal: string | null };
    adx: { value: number | null; trendStrength: string | null; plusDi: number | null; minusDi: number | null; signal: string | null };
    movingAverages: {
      sma: Record<string, number | null>;
      ema: Record<string, number | null>;
    };
  };
  levels: {
    pivot: number | null;
    supports: number[];
    resistances: number[];
    nearestSupport: number | null;
    nearestResistance: number | null;
  };
  marketStructure: {
    trend: string | null;
    strength: string | null;
    momentumAligned: boolean | null;
  };
};

export type MultiTimeframeFrame = {
  timeframe: string;
  label: string | null;
  bias: string | null;
  score: number | null;
  price: number | null;
  changePercent: number | null;
  rsi: number | null;
  macdCrossover: string | null;
  ema: { ema20: number | null; ema50: number | null; ema200: number | null };
  marketStructure: string | null;
  trendStrength: string | null;
  momentumAligned: boolean | null;
  advice: string | null;
  keyIndicators: string[];
};

export type MultiTimeframeAnalysis = {
  schemaVersion: 1;
  source: "tradingview-mcp";
  fetchedAt: string;
  symbol: string;
  exchange: string;
  frames: Record<string, MultiTimeframeFrame>;
  alignment: {
    status: string | null;
    confidence: string | null;
    netScore: number | null;
    divergentTimeframes: string[];
  };
  recommendation: {
    signal: TechnicalSignal;
    summary: string | null;
    entryTimeframe: string | null;
    rules: string[];
  };
  levels: {
    supports: number[];
    resistances: number[];
  };
};

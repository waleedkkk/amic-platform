export type IndicatorCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type IndicatorLine = {
  id: string;
  label: string;
  color: string;
  points: { time: number; value: number }[];
};

export type IndicatorZone = {
  id: string;
  kind: "bullish-ob" | "bearish-ob" | "bullish-fvg" | "bearish-fvg";
  direction: "bullish" | "bearish";
  high: number;
  low: number;
  createdAt: number;
  score?: number;
  label: string;
};

export type IndicatorLevel = {
  id: string;
  kind: "buy-side-liquidity" | "sell-side-liquidity";
  price: number;
  createdAt: number;
  label: string;
};

export type IndicatorEvent = {
  id: string;
  kind: "bullish-bos" | "bearish-bos" | "bullish-choch" | "bearish-choch" | "bullish-sweep" | "bearish-sweep";
  direction: "bullish" | "bearish";
  time: number;
  price: number;
  label: string;
  explanation: string;
};

export type IndicatorSignal = {
  id: string;
  direction: "bullish" | "bearish";
  time: number;
  price: number;
  label: "BUY" | "SELL";
  score: number;
  maxScore: number;
  reasons: string[];
};

export type IndicatorSummary = {
  mode: "normal" | "scalping";
  preset: "conservative" | "balanced" | "aggressive";
  trend: "bullish" | "bearish" | "neutral";
  confluence: { bull: number; bear: number; net: number; max: number };
  ict: {
    bull: number;
    bear: number;
    max: number;
    confirmation: IctConfirmationGate;
  };
  scalp: { bull: number; bear: number; threshold: number; max: number };
  signal: "BUY" | "SELL" | "WAIT";
  decision: { baseSignal: "BUY" | "SELL" | "WAIT"; blockedByIct: "BUY" | "SELL" | null };
  reasons: string[];
};

/** مساهمة فعلية في الدرجة النهائية بحسب وضع الحساب الحالي، للعرض التفسيري فقط. */
export type ConfluenceContribution = {
  id: string;
  label: string;
  description: string;
  direction: "bullish" | "bearish";
  points: number;
  maxPoints: number;
};

export type ChartIndicatorResult = {
  id: "confluence-ict-v3-4";
  lines: IndicatorLine[];
  zones: IndicatorZone[];
  levels: IndicatorLevel[];
  events: IndicatorEvent[];
  signals: IndicatorSignal[];
  summary: IndicatorSummary;
  breakdown: ConfluenceContribution[];
};

export type ConfluenceIctSettings = {
  mode: "normal" | "scalping";
  preset: "conservative" | "balanced" | "aggressive";
  requireSweep: boolean;
  requireStructure: boolean;
  requireFvg: boolean;
  useMomentum: boolean;
  contextBars: number;
  emaFast: number;
  emaMid: number;
  emaSlow: number;
  rsiLength: number;
  rsiOverbought: number;
  rsiOversold: number;
  stochLength: number;
  stochSmooth: number;
  adxLength: number;
  adxStrong: number;
  atrLength: number;
  swingLength: number;
  obLookback: number;
  maxOrderBlocks: number;
  mitigateOrderBlocks: boolean;
  fvgMinTicks: number;
  atrFvgMin: number;
  fillFvg: boolean;
  fillFvgMode: "wick" | "close";
  maxFvg: number;
  fvgMaxAge: number;
  showWeakFvg: boolean;
  liquidityLookback: number;
  liquidityTolerancePercent: number;
  useStructureInScore: boolean;
  strongOnly: boolean;
  ictConfirmMode: boolean;
  ictConfirmThreshold: number;
};

export const ICT_SCORE_WEIGHTS = {
  structure: 2,
  break: 1,
  sweep: 2,
  fvg: 2,
  momentum: 1,
  orderBlock: 2,
} as const;

export const ICT_MAX_SCORE = Object.values(ICT_SCORE_WEIGHTS).reduce((sum, weight) => sum + weight, 0);

export const DEFAULT_CONFLUENCE_ICT_SETTINGS: ConfluenceIctSettings = {
  mode: "normal",
  preset: "balanced",
  requireSweep: true,
  requireStructure: true,
  requireFvg: true,
  useMomentum: true,
  contextBars: 12,
  emaFast: 20,
  emaMid: 50,
  emaSlow: 200,
  rsiLength: 14,
  rsiOverbought: 70,
  rsiOversold: 30,
  stochLength: 14,
  stochSmooth: 3,
  adxLength: 14,
  adxStrong: 25,
  atrLength: 14,
  swingLength: 5,
  obLookback: 15,
  maxOrderBlocks: 3,
  mitigateOrderBlocks: true,
  fvgMinTicks: 0,
  atrFvgMin: 0.1,
  fillFvg: true,
  fillFvgMode: "wick",
  maxFvg: 10,
  fvgMaxAge: 250,
  showWeakFvg: true,
  liquidityLookback: 150,
  liquidityTolerancePercent: 0.1,
  useStructureInScore: true,
  strongOnly: true,
  ictConfirmMode: true,
  ictConfirmThreshold: 5,
};

type ResolvedSettings = ConfluenceIctSettings & {
  emaFastEffective: number;
  emaMidEffective: number;
  emaSlowEffective: number;
  rsiLengthEffective: number;
  stochLengthEffective: number;
  adxLengthEffective: number;
  swingLengthEffective: number;
  obLookbackEffective: number;
  liquidityLookbackEffective: number;
  liquidityToleranceEffective: number;
  atrFvgMinEffective: number;
  fvgMaxAgeEffective: number;
  maxFvgEffective: number;
};

type ActiveZone = IndicatorZone & { startIndex: number };

export type IctScoreEvidence = {
  trendDirection: -1 | 0 | 1;
  bullStructure: boolean;
  bearStructure: boolean;
  bullSweep: boolean;
  bearSweep: boolean;
  strongestBullFvg: number;
  strongestBearFvg: number;
  momentumBull: boolean;
  momentumBear: boolean;
  bullOrderBlock: boolean;
  bearOrderBlock: boolean;
};

export type IctConfirmationGate = {
  enabled: boolean;
  threshold: number;
  bullConfirmed: boolean;
  bearConfirmed: boolean;
};

export function calculateIctScores(evidence: IctScoreEvidence): { bull: number; bear: number; max: number } {
  const bull =
    (evidence.trendDirection === 1 ? ICT_SCORE_WEIGHTS.structure : 0) +
    (evidence.bullStructure ? ICT_SCORE_WEIGHTS.break : 0) +
    (evidence.bullSweep ? ICT_SCORE_WEIGHTS.sweep : 0) +
    (evidence.strongestBullFvg >= 4 ? ICT_SCORE_WEIGHTS.fvg : 0) +
    (evidence.momentumBull ? ICT_SCORE_WEIGHTS.momentum : 0) +
    (evidence.bullOrderBlock ? ICT_SCORE_WEIGHTS.orderBlock : 0);
  const bear =
    (evidence.trendDirection === -1 ? ICT_SCORE_WEIGHTS.structure : 0) +
    (evidence.bearStructure ? ICT_SCORE_WEIGHTS.break : 0) +
    (evidence.bearSweep ? ICT_SCORE_WEIGHTS.sweep : 0) +
    (evidence.strongestBearFvg >= 4 ? ICT_SCORE_WEIGHTS.fvg : 0) +
    (evidence.momentumBear ? ICT_SCORE_WEIGHTS.momentum : 0) +
    (evidence.bearOrderBlock ? ICT_SCORE_WEIGHTS.orderBlock : 0);
  return { bull, bear, max: ICT_MAX_SCORE };
}

export function resolveIctConfirmation(enabled: boolean, threshold: number, scores: Pick<IndicatorSummary["ict"], "bull" | "bear">): IctConfirmationGate {
  const normalizedThreshold = Math.min(ICT_MAX_SCORE, Math.max(1, Math.floor(threshold)));
  return {
    enabled,
    threshold: normalizedThreshold,
    bullConfirmed: !enabled || scores.bull >= normalizedThreshold,
    bearConfirmed: !enabled || scores.bear >= normalizedThreshold,
  };
}

export function resolveIctSignal(input: {
  mode: ConfluenceIctSettings["mode"];
  strongBuyBase: boolean;
  strongSellBase: boolean;
  scalpBullSetup: boolean;
  scalpBearSetup: boolean;
  gate: IctConfirmationGate;
}): { strongBuy: boolean; strongSell: boolean; baseSignal: "BUY" | "SELL" | "WAIT"; blockedByIct: "BUY" | "SELL" | null } {
  const baseSignal = input.strongBuyBase ? "BUY" : input.strongSellBase ? "SELL" : "WAIT";
  if (input.mode === "scalping") {
    return { strongBuy: input.strongBuyBase && input.scalpBullSetup, strongSell: input.strongSellBase && input.scalpBearSetup, baseSignal, blockedByIct: null };
  }
  const blockedByIct = input.strongBuyBase && !input.gate.bullConfirmed ? "BUY" : input.strongSellBase && !input.gate.bearConfirmed ? "SELL" : null;
  return { strongBuy: input.strongBuyBase && input.gate.bullConfirmed, strongSell: input.strongSellBase && input.gate.bearConfirmed, baseSignal, blockedByIct };
}

function positiveInteger(value: number, fallback: number, min = 1): number {
  return Number.isFinite(value) ? Math.max(min, Math.floor(value)) : fallback;
}

function resolveSettings(input?: Partial<ConfluenceIctSettings>): ResolvedSettings {
  const settings = { ...DEFAULT_CONFLUENCE_ICT_SETTINGS, ...input };
  const scalar = settings.preset === "conservative" ? "conservative" : settings.preset === "aggressive" ? "aggressive" : "balanced";
  const scalping = settings.mode === "scalping";
  const pick = (normal: number, conservative: number, balanced: number, aggressive: number) => scalping ? scalar === "conservative" ? conservative : scalar === "aggressive" ? aggressive : balanced : normal;
  return {
    ...settings,
    contextBars: positiveInteger(settings.contextBars, 12, 2),
    ictConfirmThreshold: Math.min(ICT_MAX_SCORE, positiveInteger(settings.ictConfirmThreshold, DEFAULT_CONFLUENCE_ICT_SETTINGS.ictConfirmThreshold)),
    emaFastEffective: pick(settings.emaFast, 20, 13, 9),
    emaMidEffective: pick(settings.emaMid, 50, 34, 21),
    emaSlowEffective: pick(settings.emaSlow, 200, 100, 50),
    rsiLengthEffective: pick(settings.rsiLength, 10, 8, 7),
    stochLengthEffective: pick(settings.stochLength, 9, 7, 5),
    adxLengthEffective: pick(settings.adxLength, 10, 8, 8),
    swingLengthEffective: pick(settings.swingLength, 4, 3, 2),
    obLookbackEffective: pick(settings.obLookback, 12, 9, 6),
    liquidityLookbackEffective: pick(settings.liquidityLookback, 100, 75, 50),
    liquidityToleranceEffective: pick(settings.liquidityTolerancePercent, 0.08, 0.12, 0.18),
    atrFvgMinEffective: pick(settings.atrFvgMin, 0.15, 0.1, 0.05),
    fvgMaxAgeEffective: pick(settings.fvgMaxAge, 120, 80, 50),
    maxFvgEffective: pick(settings.maxFvg, 8, 10, 10),
  };
}

function ema(values: number[], period: number): number[] {
  const output: number[] = [];
  const multiplier = 2 / (period + 1);
  let previous = values[0] ?? 0;
  for (const value of values) {
    previous = value * multiplier + previous * (1 - multiplier);
    output.push(previous);
  }
  return output;
}

function sma(values: number[], period: number): Array<number | null> {
  const output: Array<number | null> = [];
  let sum = 0;
  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index >= period) sum -= values[index - period];
    output.push(index >= period - 1 ? sum / period : null);
  }
  return output;
}

function atr(candles: IndicatorCandle[], period: number): Array<number | null> {
  const trueRanges = candles.map((candle, index) => index === 0 ? candle.high - candle.low : Math.max(candle.high - candle.low, Math.abs(candle.high - candles[index - 1].close), Math.abs(candle.low - candles[index - 1].close)));
  const output: Array<number | null> = [];
  let average = 0;
  for (let index = 0; index < trueRanges.length; index += 1) {
    if (index < period) average += trueRanges[index];
    if (index === period - 1) average /= period;
    else if (index >= period) average = (average * (period - 1) + trueRanges[index]) / period;
    output.push(index >= period - 1 ? average : null);
  }
  return output;
}

function rsi(closes: number[], period: number): Array<number | null> {
  const output: Array<number | null> = [null];
  let gain = 0;
  let loss = 0;
  for (let index = 1; index < closes.length; index += 1) {
    const change = closes[index] - closes[index - 1];
    const up = Math.max(change, 0);
    const down = Math.max(-change, 0);
    if (index <= period) {
      gain += up;
      loss += down;
      if (index === period) {
        gain /= period;
        loss /= period;
      }
    } else {
      gain = (gain * (period - 1) + up) / period;
      loss = (loss * (period - 1) + down) / period;
    }
    if (index < period) output.push(null);
    else if (loss === 0) output.push(100);
    else {
      const relativeStrength = gain / loss;
      output.push(100 - 100 / (1 + relativeStrength));
    }
  }
  return output;
}

function dmi(candles: IndicatorCandle[], period: number): { plus: Array<number | null>; minus: Array<number | null>; adx: Array<number | null> } {
  const plus: Array<number | null> = [];
  const minus: Array<number | null> = [];
  const adx: Array<number | null> = [];
  let smoothTr = 0;
  let smoothPlus = 0;
  let smoothMinus = 0;
  let smoothAdx = 0;
  for (let index = 0; index < candles.length; index += 1) {
    if (index === 0) {
      plus.push(null); minus.push(null); adx.push(null); continue;
    }
    const upMove = candles[index].high - candles[index - 1].high;
    const downMove = candles[index - 1].low - candles[index].low;
    const plusMove = upMove > downMove && upMove > 0 ? upMove : 0;
    const minusMove = downMove > upMove && downMove > 0 ? downMove : 0;
    const trueRange = Math.max(candles[index].high - candles[index].low, Math.abs(candles[index].high - candles[index - 1].close), Math.abs(candles[index].low - candles[index - 1].close));
    if (index <= period) {
      smoothTr += trueRange; smoothPlus += plusMove; smoothMinus += minusMove;
      if (index === period) { smoothTr /= period; smoothPlus /= period; smoothMinus /= period; }
    } else {
      smoothTr = (smoothTr * (period - 1) + trueRange) / period;
      smoothPlus = (smoothPlus * (period - 1) + plusMove) / period;
      smoothMinus = (smoothMinus * (period - 1) + minusMove) / period;
    }
    if (index < period || smoothTr === 0) { plus.push(null); minus.push(null); adx.push(null); continue; }
    const plusDi = 100 * smoothPlus / smoothTr;
    const minusDi = 100 * smoothMinus / smoothTr;
    const dx = plusDi + minusDi === 0 ? 0 : 100 * Math.abs(plusDi - minusDi) / (plusDi + minusDi);
    if (index < period * 2 - 1) smoothAdx += dx;
    if (index === period * 2 - 1) smoothAdx /= period;
    else if (index >= period * 2) smoothAdx = (smoothAdx * (period - 1) + dx) / period;
    plus.push(plusDi); minus.push(minusDi); adx.push(index >= period * 2 - 1 ? smoothAdx : null);
  }
  return { plus, minus, adx };
}

function pivotHigh(candles: IndicatorCandle[], index: number, radius: number): boolean {
  if (index < radius || index + radius >= candles.length) return false;
  return Array.from({ length: radius }, (_, offset) => offset + 1).every(offset => candles[index].high > candles[index - offset].high && candles[index].high >= candles[index + offset].high);
}

function pivotLow(candles: IndicatorCandle[], index: number, radius: number): boolean {
  if (index < radius || index + radius >= candles.length) return false;
  return Array.from({ length: radius }, (_, offset) => offset + 1).every(offset => candles[index].low < candles[index - offset].low && candles[index].low <= candles[index + offset].low);
}

function findLastOppositeCandle(candles: IndicatorCandle[], index: number, direction: "bullish" | "bearish", lookback: number): number | null {
  for (let offset = 1; offset <= lookback && index - offset >= 0; offset += 1) {
    const candle = candles[index - offset];
    if ((direction === "bullish" && candle.close < candle.open) || (direction === "bearish" && candle.close > candle.open)) return index - offset;
  }
  return null;
}

function dropExpiredZones(zones: ActiveZone[], candle: IndicatorCandle, index: number, settings: ResolvedSettings): ActiveZone[] {
  return zones.filter(zone => {
    const bullish = zone.direction === "bullish";
    const invalidated = zone.kind.endsWith("ob") && settings.mitigateOrderBlocks && (bullish ? candle.close < zone.low : candle.close > zone.high);
    const filled = zone.kind.endsWith("fvg") && settings.fillFvg && (settings.fillFvgMode === "wick" ? bullish ? candle.low <= zone.low : candle.high >= zone.high : bullish ? candle.close <= zone.low : candle.close >= zone.high);
    const expired = zone.kind.endsWith("fvg") && index - zone.startIndex > settings.fvgMaxAgeEffective;
    return !invalidated && !filled && !expired;
  });
}

function trimZones(zones: ActiveZone[], kind: ActiveZone["kind"], maximum: number): ActiveZone[] {
  const matching = zones.filter(zone => zone.kind === kind);
  if (matching.length <= maximum) return zones;
  const remove = new Set(matching.slice(0, matching.length - maximum).map(zone => zone.id));
  return zones.filter(zone => !remove.has(zone.id));
}

/** يعيد تنفيذ منطق Confluence ICT V3.4 على شموع AMIC من دون تشغيل Pine في المتصفح. */
export function calculateConfluenceIct(candles: IndicatorCandle[], input?: Partial<ConfluenceIctSettings>): ChartIndicatorResult {
  const settings = resolveSettings(input);
  const emptySummary: IndicatorSummary = { mode: settings.mode, preset: settings.preset, trend: "neutral", confluence: { bull: 0, bear: 0, net: 0, max: settings.useStructureInScore ? 7 : 6 }, ict: { bull: 0, bear: 0, max: ICT_MAX_SCORE, confirmation: resolveIctConfirmation(settings.ictConfirmMode, settings.ictConfirmThreshold, { bull: 0, bear: 0 }) }, scalp: { bull: 0, bear: 0, threshold: 0, max: 0 }, signal: "WAIT", decision: { baseSignal: "WAIT", blockedByIct: null }, reasons: [] };
  if (!candles.length) return { id: "confluence-ict-v3-4", lines: [], zones: [], levels: [], events: [], signals: [], summary: emptySummary, breakdown: [] };

  const closes = candles.map(candle => candle.close);
  const highs = candles.map(candle => candle.high);
  const lows = candles.map(candle => candle.low);
  const volumes = candles.map(candle => candle.volume ?? 0);
  const fast = ema(closes, settings.emaFastEffective);
  const mid = ema(closes, settings.emaMidEffective);
  const slow = ema(closes, settings.emaSlowEffective);
  const rsiValues = rsi(closes, settings.rsiLengthEffective);
  const macdFast = ema(closes, 12);
  const macdSlow = ema(closes, 26);
  const macdLine = closes.map((_, index) => macdFast[index] - macdSlow[index]);
  const macdSignal = ema(macdLine, 9);
  const macdHistogram = macdLine.map((value, index) => value - macdSignal[index]);
  const rawStoch = closes.map((value, index) => {
    const start = Math.max(0, index - settings.stochLengthEffective + 1);
    const high = Math.max(...highs.slice(start, index + 1));
    const low = Math.min(...lows.slice(start, index + 1));
    return high === low ? 50 : 100 * (value - low) / (high - low);
  });
  const stochK = sma(rawStoch, settings.mode === "scalping" ? 3 : settings.stochSmooth);
  const stochD = sma(stochK.map(value => value ?? 50), settings.mode === "scalping" ? 3 : settings.stochSmooth);
  const atrValues = atr(candles, settings.atrLength);
  const directional = dmi(candles, settings.adxLengthEffective);
  const obv = volumes.map((volume, index) => index === 0 ? volume : (closes[index] > closes[index - 1] ? 1 : closes[index] < closes[index - 1] ? -1 : 0) * volume).reduce<number[]>((values, value) => { values.push((values.at(-1) ?? 0) + value); return values; }, []);
  const obvAverage = sma(obv, 20);

  let lastSwingHigh: { price: number; index: number } | null = null;
  let lastSwingLow: { price: number; index: number } | null = null;
  let previousPivotHigh: { price: number; index: number } | null = null;
  let previousPivotLow: { price: number; index: number } | null = null;
  let liquidityHigh: IndicatorLevel | null = null;
  let liquidityLow: IndicatorLevel | null = null;
  let trendDirection: -1 | 0 | 1 = 0;
  let latestBreakdown: ConfluenceContribution[] = [];
  let lastBullSweep = -Infinity;
  let lastBearSweep = -Infinity;
  let lastBullStructure = -Infinity;
  let lastBearStructure = -Infinity;
  let zones: ActiveZone[] = [];
  const levels: IndicatorLevel[] = [];
  const events: IndicatorEvent[] = [];
  const signals: IndicatorSignal[] = [];
  let previousStrongBuy = false;
  let previousStrongSell = false;
  let latestSummary = emptySummary;

  for (let index = 0; index < candles.length; index += 1) {
    const candle = candles[index];
    zones = dropExpiredZones(zones, candle, index, settings);
    const bullishBreak = Boolean(lastSwingHigh && index > 0 && candles[index - 1].close <= lastSwingHigh.price && candle.close > lastSwingHigh.price);
    const bearishBreak = Boolean(lastSwingLow && index > 0 && candles[index - 1].close >= lastSwingLow.price && candle.close < lastSwingLow.price);
    let bullStructure = false;
    let bearStructure = false;
    if (bullishBreak && lastSwingHigh) {
      const choch = trendDirection <= 0;
      bullStructure = true;
      trendDirection = 1;
      events.push({ id: `${choch ? "choch" : "bos"}-bull-${candle.time}`, kind: choch ? "bullish-choch" : "bullish-bos", direction: "bullish", time: candle.time, price: candle.close, label: choch ? "CHoCH ↑" : "BOS ↑", explanation: choch ? "تحول هيكل السوق بعد إغلاق فوق آخر Swing High." : "استمرار هيكل صاعد بعد كسر آخر Swing High." });
      lastBullStructure = index;
      lastSwingHigh = null;
    }
    if (bearishBreak && lastSwingLow) {
      const choch = trendDirection >= 0;
      bearStructure = true;
      trendDirection = -1;
      events.push({ id: `${choch ? "choch" : "bos"}-bear-${candle.time}`, kind: choch ? "bearish-choch" : "bearish-bos", direction: "bearish", time: candle.time, price: candle.close, label: choch ? "CHoCH ↓" : "BOS ↓", explanation: choch ? "تحول هيكل السوق بعد إغلاق أدنى آخر Swing Low." : "استمرار هيكل هابط بعد كسر آخر Swing Low." });
      lastBearStructure = index;
      lastSwingLow = null;
    }

    const pivotIndex = index - settings.swingLengthEffective;
    if (pivotIndex >= settings.swingLengthEffective) {
      if (pivotHigh(candles, pivotIndex, settings.swingLengthEffective)) {
        const pivot = { price: candles[pivotIndex].high, index: pivotIndex };
        if (previousPivotHigh) {
          const distance = Math.abs(pivot.price - previousPivotHigh.price) / Math.max(previousPivotHigh.price, Number.EPSILON) * 100;
          if (distance <= settings.liquidityToleranceEffective && pivot.index - previousPivotHigh.index <= settings.liquidityLookbackEffective) {
            const price = (pivot.price + previousPivotHigh.price) / 2;
            liquidityHigh = { id: `bsl-${candles[pivotIndex].time}`, kind: "buy-side-liquidity", price, createdAt: candles[pivotIndex].time, label: "BSL" };
            levels.push(liquidityHigh);
          }
        }
        previousPivotHigh = pivot;
        lastSwingHigh = pivot;
      }
      if (pivotLow(candles, pivotIndex, settings.swingLengthEffective)) {
        const pivot = { price: candles[pivotIndex].low, index: pivotIndex };
        if (previousPivotLow) {
          const distance = Math.abs(pivot.price - previousPivotLow.price) / Math.max(previousPivotLow.price, Number.EPSILON) * 100;
          if (distance <= settings.liquidityToleranceEffective && pivot.index - previousPivotLow.index <= settings.liquidityLookbackEffective) {
            const price = (pivot.price + previousPivotLow.price) / 2;
            liquidityLow = { id: `ssl-${candles[pivotIndex].time}`, kind: "sell-side-liquidity", price, createdAt: candles[pivotIndex].time, label: "SSL" };
            levels.push(liquidityLow);
          }
        }
        previousPivotLow = pivot;
        lastSwingLow = pivot;
      }
    }

    const bullSweep = Boolean(liquidityLow && candle.low < liquidityLow.price && candle.close > liquidityLow.price);
    const bearSweep = Boolean(liquidityHigh && candle.high > liquidityHigh.price && candle.close < liquidityHigh.price);
    if (bullSweep) { lastBullSweep = index; events.push({ id: `ssl-sweep-${candle.time}`, kind: "bullish-sweep", direction: "bullish", time: candle.time, price: candle.low, label: "SSL SWEEP ↑", explanation: "اخترق الذيل Sell-side Liquidity ثم أغلق السعر أعلى المستوى." }); }
    if (bearSweep) { lastBearSweep = index; events.push({ id: `bsl-sweep-${candle.time}`, kind: "bearish-sweep", direction: "bearish", time: candle.time, price: candle.high, label: "BSL SWEEP ↓", explanation: "اخترق الذيل Buy-side Liquidity ثم أغلق السعر أدنى المستوى." }); }

    if (bullishBreak) {
      const source = findLastOppositeCandle(candles, index, "bullish", settings.obLookbackEffective);
      if (source !== null) zones.push({ id: `bull-ob-${candles[source].time}`, kind: "bullish-ob", direction: "bullish", high: candles[source].high, low: candles[source].low, createdAt: candles[source].time, label: "Bullish OB", startIndex: source });
    }
    if (bearishBreak) {
      const source = findLastOppositeCandle(candles, index, "bearish", settings.obLookbackEffective);
      if (source !== null) zones.push({ id: `bear-ob-${candles[source].time}`, kind: "bearish-ob", direction: "bearish", high: candles[source].high, low: candles[source].low, createdAt: candles[source].time, label: "Bearish OB", startIndex: source });
    }
    zones = trimZones(trimZones(zones, "bullish-ob", settings.maxOrderBlocks), "bearish-ob", settings.maxOrderBlocks);

    const bullStructureContext = index - lastBullStructure <= settings.contextBars;
    const bearStructureContext = index - lastBearStructure <= settings.contextBars;
    const bullSweepContext = index - lastBullSweep <= settings.contextBars;
    const bearSweepContext = index - lastBearSweep <= settings.contextBars;
    const currentAtr = atrValues[index] ?? 0;
    const minGap = settings.fvgMinTicks;
    if (index >= 2 && candle.low > candles[index - 2].high) {
      const gap = candle.low - candles[index - 2].high;
      if (gap > minGap && gap >= currentAtr * settings.atrFvgMinEffective) {
        const score = Math.min(5, 1 + (trendDirection === 1 ? 1 : 0) + (bullStructureContext ? 1 : 0) + (bullSweepContext ? 1 : 0) + (gap >= currentAtr * 0.5 ? 1 : 0));
        if (settings.showWeakFvg || score >= 3) zones.push({ id: `bull-fvg-${candle.time}`, kind: "bullish-fvg", direction: "bullish", high: candle.low, low: candles[index - 2].high, createdAt: candles[index - 2].time, score, label: `Bull FVG ★${score}`, startIndex: index });
      }
    }
    if (index >= 2 && candle.high < candles[index - 2].low) {
      const gap = candles[index - 2].low - candle.high;
      if (gap > minGap && gap >= currentAtr * settings.atrFvgMinEffective) {
        const score = Math.min(5, 1 + (trendDirection === -1 ? 1 : 0) + (bearStructureContext ? 1 : 0) + (bearSweepContext ? 1 : 0) + (gap >= currentAtr * 0.5 ? 1 : 0));
        if (settings.showWeakFvg || score >= 3) zones.push({ id: `bear-fvg-${candle.time}`, kind: "bearish-fvg", direction: "bearish", high: candles[index - 2].low, low: candle.high, createdAt: candles[index - 2].time, score, label: `Bear FVG ★${score}`, startIndex: index });
      }
    }
    zones = trimZones(trimZones(zones, "bullish-fvg", settings.maxFvgEffective), "bearish-fvg", settings.maxFvgEffective);

    const trendUp = candle.close > fast[index] && fast[index] > mid[index] && mid[index] > slow[index];
    const trendDown = candle.close < fast[index] && fast[index] < mid[index] && mid[index] < slow[index];
    const rsiValue = rsiValues[index];
    const rsiBull = rsiValue !== null && rsiValue > 50 && rsiValue < settings.rsiOverbought;
    const rsiBear = rsiValue !== null && rsiValue < 50 && rsiValue > settings.rsiOversold;
    const overbought = rsiValue !== null && rsiValue >= settings.rsiOverbought || (stochK[index] ?? 50) >= 80;
    const oversold = rsiValue !== null && rsiValue <= settings.rsiOversold || (stochK[index] ?? 50) <= 20;
    const macdBull = macdLine[index] > macdSignal[index] && macdHistogram[index] > 0;
    const macdBear = macdLine[index] < macdSignal[index] && macdHistogram[index] < 0;
    const stochasticBull = (stochK[index] ?? 50) > (stochD[index] ?? 50) && (stochK[index] ?? 50) < 80;
    const stochasticBear = (stochK[index] ?? 50) < (stochD[index] ?? 50) && (stochK[index] ?? 50) > 20;
    const adxBull = (directional.adx[index] ?? 0) >= settings.adxStrong && (directional.plus[index] ?? 0) > (directional.minus[index] ?? 0);
    const adxBear = (directional.adx[index] ?? 0) >= settings.adxStrong && (directional.plus[index] ?? 0) < (directional.minus[index] ?? 0);
    const obvBull = obvAverage[index] !== null && obv[index] > (obvAverage[index] as number);
    const obvBear = obvAverage[index] !== null && obv[index] < (obvAverage[index] as number);
    const strongestBullFvg = Math.max(0, ...zones.filter(zone => zone.kind === "bullish-fvg").map(zone => zone.score ?? 0));
    const strongestBearFvg = Math.max(0, ...zones.filter(zone => zone.kind === "bearish-fvg").map(zone => zone.score ?? 0));
    const bullFvgRetest = zones.some(zone => zone.kind === "bullish-fvg" && (zone.score ?? 0) >= 4 && candle.close <= zone.high && candle.close >= zone.low);
    const bearFvgRetest = zones.some(zone => zone.kind === "bearish-fvg" && (zone.score ?? 0) >= 4 && candle.close <= zone.high && candle.close >= zone.low);
    const bullObContext = zones.some(zone => zone.kind === "bullish-ob" && candle.close <= zone.high && candle.close >= zone.low);
    const bearObContext = zones.some(zone => zone.kind === "bearish-ob" && candle.close <= zone.high && candle.close >= zone.low);
    const momentumBull = macdBull && (!settings.useMomentum || (rsiValue ?? 0) > 45 && (stochK[index] ?? 0) > (stochD[index] ?? 0));
    const momentumBear = macdBear && (!settings.useMomentum || (rsiValue ?? 100) < 55 && (stochK[index] ?? 100) < (stochD[index] ?? 100));
    const scalpMax = 3 + (settings.requireStructure ? 2 : 0) + (settings.requireSweep ? 2 : 0) + (settings.requireFvg ? 2 : 0);
    const ratio = settings.preset === "conservative" ? 7 / 9 : settings.preset === "aggressive" ? 5 / 9 : 6 / 9;
    const scalpThreshold = Math.max(1, Math.ceil(scalpMax * ratio));
    const scalpBull = (trendUp ? 1 : 0) + (momentumBull ? 1 : 0) + (bullObContext ? 1 : 0) + (settings.requireStructure && bullStructureContext ? 2 : 0) + (settings.requireSweep && bullSweepContext ? 2 : 0) + (settings.requireFvg && bullFvgRetest ? 2 : 0);
    const scalpBear = (trendDown ? 1 : 0) + (momentumBear ? 1 : 0) + (bearObContext ? 1 : 0) + (settings.requireStructure && bearStructureContext ? 2 : 0) + (settings.requireSweep && bearSweepContext ? 2 : 0) + (settings.requireFvg && bearFvgRetest ? 2 : 0);
    const maxScore = settings.useStructureInScore ? 7 : 6;
    const bullScore = (trendUp ? 1 : 0) + (rsiBull ? 1 : 0) + (macdBull ? 1 : 0) + (stochasticBull ? 1 : 0) + (adxBull ? 1 : 0) + (obvBull ? 1 : 0) + (settings.useStructureInScore && trendDirection === 1 ? 1 : 0);
    const bearScore = (trendDown ? 1 : 0) + (rsiBear ? 1 : 0) + (macdBear ? 1 : 0) + (stochasticBear ? 1 : 0) + (adxBear ? 1 : 0) + (obvBear ? 1 : 0) + (settings.useStructureInScore && trendDirection === -1 ? 1 : 0);
    const buyThreshold = settings.mode === "scalping" ? settings.preset === "conservative" ? 5 : settings.preset === "aggressive" ? 3 : 4 : settings.strongOnly ? settings.useStructureInScore ? 5 : 4 : 2;
    const sellThreshold = -buyThreshold;
    const strongBuyBase = bullScore - bearScore >= buyThreshold && (settings.mode === "scalping" ? momentumBull : !overbought);
    const strongSellBase = bullScore - bearScore <= sellThreshold && (settings.mode === "scalping" ? momentumBear : !oversold);
    const ictScores = calculateIctScores({ trendDirection, bullStructure, bearStructure, bullSweep, bearSweep, strongestBullFvg, strongestBearFvg, momentumBull: macdBull && rsiBull, momentumBear: macdBear && rsiBear, bullOrderBlock: bullObContext, bearOrderBlock: bearObContext });
    const ictGate = resolveIctConfirmation(settings.ictConfirmMode, settings.ictConfirmThreshold, ictScores);
    const decision = resolveIctSignal({ mode: settings.mode, strongBuyBase, strongSellBase, scalpBullSetup: scalpBull >= scalpThreshold, scalpBearSetup: scalpBear >= scalpThreshold, gate: ictGate });
    const strongBuy = decision.strongBuy;
    const strongSell = decision.strongSell;
    const reasons = [trendUp ? "EMA" : trendDown ? "EMA" : "", rsiBull || rsiBear ? "RSI" : "", macdBull || macdBear ? "MACD" : "", stochasticBull || stochasticBear ? "Stochastic" : "", adxBull || adxBear ? "ADX" : "", obvBull || obvBear ? "OBV" : "", trendDirection !== 0 ? "Structure" : "", bullSweep || bearSweep ? "Sweep" : "", bullFvgRetest || bearFvgRetest ? "FVG" : "", bullObContext || bearObContext ? "OB" : "", decision.blockedByIct === "BUY" ? `بوابة ICT: شراء ${ictScores.bull}/${ictScores.max} أقل من ${ictGate.threshold}` : "", decision.blockedByIct === "SELL" ? `بوابة ICT: بيع ${ictScores.bear}/${ictScores.max} أقل من ${ictGate.threshold}` : ""].filter(Boolean);
    if (strongBuy && !previousStrongBuy) signals.push({ id: `buy-${candle.time}`, direction: "bullish", time: candle.time, price: candle.close, label: "BUY", score: settings.mode === "scalping" ? scalpBull : bullScore - bearScore, maxScore: settings.mode === "scalping" ? scalpMax : maxScore, reasons });
    if (strongSell && !previousStrongSell) signals.push({ id: `sell-${candle.time}`, direction: "bearish", time: candle.time, price: candle.close, label: "SELL", score: settings.mode === "scalping" ? scalpBear : bearScore - bullScore, maxScore: settings.mode === "scalping" ? scalpMax : maxScore, reasons });
    previousStrongBuy = strongBuy;
    previousStrongSell = strongSell;
    const contribution = (id: string, label: string, description: string, bull: boolean, bear: boolean, points: number, maxPoints: number): ConfluenceContribution | null => {
      if (!bull && !bear) return null;
      return { id, label, description, direction: bull ? "bullish" : "bearish", points, maxPoints };
    };
    latestBreakdown = (settings.mode === "scalping"
      ? [
          contribution("ema", "ترتيب المتوسطات", "ترتيب EMA السريع والمتوسط والبطيء يدعم الاتجاه.", trendUp, trendDown, 1, 1),
          contribution("momentum", "زخم السعر", "توافق MACD مع مرشح الزخم النشط يدعم الاتجاه.", momentumBull, momentumBear, 1, 1),
          contribution("order-block", "منطقة Order Block", "السعر داخل منطقة أمر معاكسة مُكتشفة سابقًا.", bullObContext, bearObContext, 1, 1),
          contribution("structure", "بنية السوق", "حدث BOS أو CHoCH حديث ضمن نافذة السياق المحددة.", bullStructureContext, bearStructureContext, settings.requireStructure ? 2 : 0, settings.requireStructure ? 2 : 0),
          contribution("liquidity", "سيولة / Sweep", "حدث سحب سيولة حديث ضمن نافذة السياق المحددة.", bullSweepContext, bearSweepContext, settings.requireSweep ? 2 : 0, settings.requireSweep ? 2 : 0),
          contribution("fvg", "فجوة سعرية FVG", "السعر يعيد اختبار فجوة سعرية قوية ونشطة.", bullFvgRetest, bearFvgRetest, settings.requireFvg ? 2 : 0, settings.requireFvg ? 2 : 0),
        ]
      : [
          contribution("ema", "ترتيب المتوسطات", "ترتيب EMA السريع والمتوسط والبطيء يدعم الاتجاه.", trendUp, trendDown, 1, 1),
          contribution("rsi", "RSI", "مؤشر القوة النسبية داخل نطاق يؤيد الاتجاه.", rsiBull, rsiBear, 1, 1),
          contribution("macd", "MACD", "تقاطع وخط هيستوغرام MACD يؤيدان الاتجاه.", macdBull, macdBear, 1, 1),
          contribution("stochastic", "Stochastic", "تقاطع Stochastic يقع خارج منطقة التشبع المعاكسة.", stochasticBull, stochasticBear, 1, 1),
          contribution("adx", "قوة الاتجاه ADX", "قوة الاتجاه تجاوزت العتبة مع اتجاه DMI المناسب.", adxBull, adxBear, 1, 1),
          contribution("obv", "تدفق الحجم OBV", "حجم التراكم أو التصريف يؤيد الاتجاه.", obvBull, obvBear, 1, 1),
          contribution("structure", "بنية السوق", "الاتجاه البنيوي الحالي أضاف نقطة إلى درجة التلاقي.", trendDirection === 1, trendDirection === -1, settings.useStructureInScore ? 1 : 0, settings.useStructureInScore ? 1 : 0),
        ]
    ).filter((item): item is ConfluenceContribution => Boolean(item && item.points > 0));
    latestSummary = {
      mode: settings.mode,
      preset: settings.preset,
      trend: trendDirection === 1 ? "bullish" : trendDirection === -1 ? "bearish" : "neutral",
      confluence: { bull: bullScore, bear: bearScore, net: bullScore - bearScore, max: maxScore },
      ict: { ...ictScores, confirmation: ictGate },
      scalp: { bull: scalpBull, bear: scalpBear, threshold: scalpThreshold, max: scalpMax },
      signal: strongBuy ? "BUY" : strongSell ? "SELL" : "WAIT",
      decision: { baseSignal: decision.baseSignal, blockedByIct: decision.blockedByIct },
      reasons,
    };
  }

  const line = (id: string, label: string, color: string, values: number[]) => ({ id, label, color, points: candles.map((candle, index) => ({ time: candle.time, value: values[index] })) });
  return {
    id: "confluence-ict-v3-4",
    lines: [line("ema-fast", `EMA ${settings.emaFastEffective}`, "#facc15", fast), line("ema-mid", `EMA ${settings.emaMidEffective}`, "#fb923c", mid), line("ema-slow", `EMA ${settings.emaSlowEffective}`, "#ef4444", slow)],
    zones: zones.map(({ startIndex: _startIndex, ...zone }) => zone),
    levels: levels.slice(-20),
    events: events.slice(-120),
    signals: signals.slice(-40),
    summary: latestSummary,
    breakdown: latestBreakdown,
  };
}

export type ChartIndicatorDefinition = {
  id: "confluence-ict-v3-4";
  title: string;
  calculate: (candles: IndicatorCandle[], settings?: Partial<ConfluenceIctSettings>) => ChartIndicatorResult;
};

export const CHART_INDICATOR_REGISTRY: Record<"confluence-ict-v3-4", ChartIndicatorDefinition> = {
  "confluence-ict-v3-4": { id: "confluence-ict-v3-4", title: "Confluence ICT V3.4", calculate: calculateConfluenceIct },
};

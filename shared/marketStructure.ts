export type StructureCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type SwingPoint = {
  time: number;
  price: number;
  kind: "high" | "low";
  index: number;
};

export type PriceLevel = {
  id: string;
  kind: "support" | "resistance";
  price: number;
  touches: number;
  createdAt: number;
  invalidation: number;
};

export type PriceZone = {
  id: string;
  kind: "demand" | "supply";
  high: number;
  low: number;
  createdAt: number;
  state: "fresh" | "tested" | "invalidated";
  invalidation: number;
};

export type StructureEvent = {
  id: string;
  kind: "bullish-breakout" | "bearish-breakdown" | "bullish-reversal" | "bearish-reversal";
  time: number;
  price: number;
  level: number;
  explanation: string;
};

export type MarketStructure = {
  swings: SwingPoint[];
  levels: PriceLevel[];
  zones: PriceZone[];
  events: StructureEvent[];
};

export type MarketStructureOptions = {
  swingRadius?: number;
  levelTolerance?: number;
  confirmationBars?: number;
};

const defaultOptions: Required<MarketStructureOptions> = {
  swingRadius: 2,
  levelTolerance: 0.0025,
  confirmationBars: 3,
};

function positiveNumber(value: number | undefined, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : fallback;
}

/** يحدد القمم والقيعان المتأرجحة دون معرفة مسبقة بالشموع اللاحقة خارج نصف القطر المعطى. */
export function detectSwingPoints(candles: StructureCandle[], radius = defaultOptions.swingRadius): SwingPoint[] {
  const result: SwingPoint[] = [];
  const safeRadius = Math.max(1, Math.floor(positiveNumber(radius, defaultOptions.swingRadius)));

  for (let index = safeRadius; index < candles.length - safeRadius; index += 1) {
    const current = candles[index];
    let isHigh = true;
    let isLow = true;

    for (let offset = 1; offset <= safeRadius; offset += 1) {
      if (current.high <= candles[index - offset].high || current.high < candles[index + offset].high) isHigh = false;
      if (current.low >= candles[index - offset].low || current.low > candles[index + offset].low) isLow = false;
    }

    if (isHigh) result.push({ time: current.time, price: current.high, kind: "high", index });
    if (isLow) result.push({ time: current.time, price: current.low, kind: "low", index });
  }

  return result;
}

function clusterSwings(swings: SwingPoint[], kind: SwingPoint["kind"], tolerance: number): PriceLevel[] {
  const matching = swings.filter(swing => swing.kind === kind).sort((a, b) => a.price - b.price);
  const clusters: SwingPoint[][] = [];

  for (const swing of matching) {
    const active = clusters.at(-1);
    const center = active ? active.reduce((sum, point) => sum + point.price, 0) / active.length : 0;
    if (active && Math.abs(swing.price - center) / Math.max(center, Number.EPSILON) <= tolerance) {
      active.push(swing);
    } else {
      clusters.push([swing]);
    }
  }

  return clusters.map((cluster, index) => {
    const price = cluster.reduce((sum, point) => sum + point.price, 0) / cluster.length;
    const createdAt = Math.min(...cluster.map(point => point.time));
    const support = kind === "low";
    return {
      id: `${support ? "support" : "resistance"}-${index}-${createdAt}`,
      kind: support ? "support" : "resistance",
      price,
      touches: cluster.length,
      createdAt,
      invalidation: support ? price * (1 - tolerance) : price * (1 + tolerance),
    };
  });
}

/** يجمع نقاط السوينغ المتقاربة إلى مستويات قابلة للتفسير بدلاً من خط لكل قمة أو قاع. */
export function derivePriceLevels(swings: SwingPoint[], tolerance = defaultOptions.levelTolerance): PriceLevel[] {
  const safeTolerance = positiveNumber(tolerance, defaultOptions.levelTolerance);
  return [...clusterSwings(swings, "low", safeTolerance), ...clusterSwings(swings, "high", safeTolerance)];
}

function zoneForSwing(candles: StructureCandle[], swing: SwingPoint, confirmationBars: number): PriceZone | null {
  const candle = candles[swing.index];
  const remaining = candles.slice(swing.index + 1, swing.index + 1 + confirmationBars);
  if (remaining.length === 0) return null;
  const bodyHigh = Math.max(candle.open, candle.close);
  const bodyLow = Math.min(candle.open, candle.close);

  if (swing.kind === "low") {
    const confirmed = remaining.some(next => next.close > candle.high);
    if (!confirmed) return null;
    return {
      id: `demand-${candle.time}`,
      kind: "demand",
      high: bodyHigh,
      low: candle.low,
      createdAt: candle.time,
      state: "fresh",
      invalidation: candle.low,
    };
  }

  const confirmed = remaining.some(next => next.close < candle.low);
  if (!confirmed) return null;
  return {
    id: `supply-${candle.time}`,
    kind: "supply",
    high: candle.high,
    low: bodyLow,
    createdAt: candle.time,
    state: "fresh",
    invalidation: candle.high,
  };
}

/** يحول القمم والقيعان المؤكدة إلى مناطق طلب/عرض عندما يتبعها اندفاع سعري واضح. */
export function deriveSupplyDemandZones(
  candles: StructureCandle[],
  swings: SwingPoint[],
  confirmationBars = defaultOptions.confirmationBars,
): PriceZone[] {
  const safeConfirmationBars = Math.max(1, Math.floor(positiveNumber(confirmationBars, defaultOptions.confirmationBars)));
  return swings
    .map(swing => zoneForSwing(candles, swing, safeConfirmationBars))
    .filter((zone): zone is PriceZone => zone !== null);
}

function mostRecentLevelBefore(levels: PriceLevel[], kind: PriceLevel["kind"], time: number): PriceLevel | null {
  return levels
    .filter(level => level.kind === kind && level.createdAt < time)
    .sort((a, b) => b.createdAt - a.createdAt)
    .at(0) ?? null;
}

/** يلتقط كسرًا عند الإغلاق وراء أحدث مستوى معروف، لا عند مجرد لمس ذيل الشمعة. */
export function detectStructureEvents(candles: StructureCandle[], levels: PriceLevel[]): StructureEvent[] {
  const events: StructureEvent[] = [];

  for (let index = 1; index < candles.length; index += 1) {
    const previous = candles[index - 1];
    const current = candles[index];
    const resistance = mostRecentLevelBefore(levels, "resistance", current.time);
    const support = mostRecentLevelBefore(levels, "support", current.time);
    const priorResistance = mostRecentLevelBefore(levels, "resistance", previous.time);
    const priorSupport = mostRecentLevelBefore(levels, "support", previous.time);

    if (resistance && previous.close <= resistance.price && current.close > resistance.price) {
      events.push({
        id: `bullish-breakout-${current.time}-${resistance.id}`,
        kind: "bullish-breakout",
        time: current.time,
        price: current.close,
        level: resistance.price,
        explanation: "إغلاق الشمعة فوق أحدث مستوى مقاومة مؤكد.",
      });
    }

    if (support && previous.close >= support.price && current.close < support.price) {
      events.push({
        id: `bearish-breakdown-${current.time}-${support.id}`,
        kind: "bearish-breakdown",
        time: current.time,
        price: current.close,
        level: support.price,
        explanation: "إغلاق الشمعة أدنى أحدث مستوى دعم مؤكد.",
      });
    }

    if (priorResistance && previous.high > priorResistance.price && previous.close >= priorResistance.price && current.close < priorResistance.price) {
      events.push({
        id: `bearish-reversal-${current.time}-${priorResistance.id}`,
        kind: "bearish-reversal",
        time: current.time,
        price: current.close,
        level: priorResistance.price,
        explanation: "فشل الاختراق: لامست الشمعة السابقة ما فوق المقاومة ثم عاد الإغلاق أسفلها.",
      });
    }

    if (priorSupport && previous.low < priorSupport.price && previous.close <= priorSupport.price && current.close > priorSupport.price) {
      events.push({
        id: `bullish-reversal-${current.time}-${priorSupport.id}`,
        kind: "bullish-reversal",
        time: current.time,
        price: current.close,
        level: priorSupport.price,
        explanation: "فشل الكسر: هبطت الشمعة السابقة أدنى الدعم ثم عاد الإغلاق فوقه.",
      });
    }
  }

  return events;
}

export function analyzeMarketStructure(candles: StructureCandle[], options: MarketStructureOptions = {}): MarketStructure {
  const resolved = { ...defaultOptions, ...options };
  const swings = detectSwingPoints(candles, resolved.swingRadius);
  const levels = derivePriceLevels(swings, resolved.levelTolerance);
  return {
    swings,
    levels,
    zones: deriveSupplyDemandZones(candles, swings, resolved.confirmationBars),
    events: detectStructureEvents(candles, levels),
  };
}

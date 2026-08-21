export const FAST_SMA_PERIOD = 20;
export const SLOW_SMA_PERIOD = 50;

export type CrossoverCandle = {
  time: number;
  close: number;
};

export type MovingAverageCrossover = {
  kind: "golden" | "death";
  crossedAt: number;
  price: number;
  fastValue: number;
  slowValue: number;
  fastPeriod: number;
  slowPeriod: number;
  barsSince: number;
};

export function calculateSma(values: number[], period: number): (number | null)[] {
  const result: (number | null)[] = [];
  let sum = 0;

  for (let index = 0; index < values.length; index += 1) {
    sum += values[index];
    if (index >= period) sum -= values[index - period];
    result.push(index >= period - 1 ? sum / period : null);
  }

  return result;
}

/**
 * يستخرج أحدث تقاطع مكتمل بين SMA السريع والبطيء. يُعرَّف التقاطع الذهبي
 * بانتقال المتوسط السريع من أسفل/مساوٍ إلى أعلى المتوسط البطيء، والعكس لتقاطع الموت.
 */
export function findLatestSmaCrossover(
  candles: CrossoverCandle[],
  fastPeriod = FAST_SMA_PERIOD,
  slowPeriod = SLOW_SMA_PERIOD,
): MovingAverageCrossover | null {
  if (fastPeriod <= 0 || slowPeriod <= fastPeriod || candles.length <= slowPeriod) return null;

  const closes = candles.map(candle => candle.close);
  const fast = calculateSma(closes, fastPeriod);
  const slow = calculateSma(closes, slowPeriod);
  let latest: MovingAverageCrossover | null = null;

  for (let index = slowPeriod; index < candles.length; index += 1) {
    const previousFast = fast[index - 1];
    const previousSlow = slow[index - 1];
    const currentFast = fast[index];
    const currentSlow = slow[index];
    if ([previousFast, previousSlow, currentFast, currentSlow].some(value => value === null)) continue;

    const golden = (previousFast as number) <= (previousSlow as number) && (currentFast as number) > (currentSlow as number);
    const death = (previousFast as number) >= (previousSlow as number) && (currentFast as number) < (currentSlow as number);
    if (!golden && !death) continue;

    latest = {
      kind: golden ? "golden" : "death",
      crossedAt: candles[index].time,
      price: candles[index].close,
      fastValue: currentFast as number,
      slowValue: currentSlow as number,
      fastPeriod,
      slowPeriod,
      barsSince: candles.length - index - 1,
    };
  }

  return latest;
}

export type CorrelationCandle = { time: number; close: number };

export function calculatePearsonCorrelation(left: number[], right: number[]): number | null {
  if (left.length !== right.length || left.length < 2) return null;
  const leftMean = left.reduce((sum, value) => sum + value, 0) / left.length;
  const rightMean = right.reduce((sum, value) => sum + value, 0) / right.length;
  let covariance = 0;
  let leftVariance = 0;
  let rightVariance = 0;
  for (let index = 0; index < left.length; index += 1) {
    const leftDelta = left[index] - leftMean;
    const rightDelta = right[index] - rightMean;
    covariance += leftDelta * rightDelta;
    leftVariance += leftDelta ** 2;
    rightVariance += rightDelta ** 2;
  }
  const denominator = Math.sqrt(leftVariance * rightVariance);
  return denominator > 0 ? Math.max(-1, Math.min(1, covariance / denominator)) : null;
}

export function correlationFromCandles(left: CorrelationCandle[], right: CorrelationCandle[]) {
  const rightByTime = new Map(right.map(candle => [candle.time, candle.close]));
  const aligned = left.map(candle => ({ time: candle.time, left: candle.close, right: rightByTime.get(candle.time) })).filter((item): item is { time: number; left: number; right: number } => Number.isFinite(item.right));
  const leftReturns: number[] = [];
  const rightReturns: number[] = [];
  for (let index = 1; index < aligned.length; index += 1) {
    const previous = aligned[index - 1];
    const current = aligned[index];
    if (previous.left === 0 || previous.right === 0) continue;
    leftReturns.push((current.left - previous.left) / previous.left);
    rightReturns.push((current.right - previous.right) / previous.right);
  }
  return { value: calculatePearsonCorrelation(leftReturns, rightReturns), sampleSize: leftReturns.length };
}

import type { IndicatorCandle } from "./confluenceIct";

/** لا تُعيد سوى الشموع التي أصبحت مرئية في خطوة Replay الحالية. */
export function getReplayVisibleCandles<T extends IndicatorCandle>(candles: T[], lastVisibleIndex: number) {
  if (lastVisibleIndex < 0 || !candles.length) return [] as T[];
  return candles.slice(0, Math.min(lastVisibleIndex + 1, candles.length));
}

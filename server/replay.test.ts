import { describe, expect, it } from "vitest";
import { getReplayVisibleCandles } from "../shared/replay";

describe("وضع Replay", () => {
  it("لا يعيد أي شمعة بعد المؤشر المرئي", () => {
    const candles = [1, 2, 3, 4].map(time => ({ time, open: time, high: time, low: time, close: time }));
    expect(getReplayVisibleCandles(candles, 1).map(candle => candle.time)).toEqual([1, 2]);
    expect(getReplayVisibleCandles(candles, -1)).toEqual([]);
  });
});

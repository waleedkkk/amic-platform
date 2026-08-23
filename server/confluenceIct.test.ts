import { describe, expect, it } from "vitest";
import { calculateConfluenceIct, type IndicatorCandle } from "../shared/confluenceIct";

function candles(): IndicatorCandle[] {
  return Array.from({ length: 280 }, (_, index) => {
    const close = 100 + index * 0.8;
    return { time: 1_700_000_000 + index * 3_600, open: close - 0.3, high: close + 0.7, low: close - 0.8, close, volume: 1_000 + index * 5 };
  });
}

describe("تفكيك Confluence للواجهة", () => {
  it("يعيد العوامل الفعالة مع نقاطها من الحساب نفسه دون تغيير ملخص الإشارة", () => {
    const result = calculateConfluenceIct(candles(), { strongOnly: false });
    expect(result.breakdown.length).toBeGreaterThan(0);
    expect(result.breakdown).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "ema", direction: "bullish", points: 1, maxPoints: 1 }),
    ]));
    expect(result.breakdown.every(item => item.points > 0 && item.points <= item.maxPoints)).toBe(true);
    expect(["BUY", "SELL", "WAIT"]).toContain(result.summary.signal);
  });
});

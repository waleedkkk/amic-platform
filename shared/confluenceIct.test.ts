import { describe, expect, it } from "vitest";
import { CHART_INDICATOR_REGISTRY, calculateConfluenceIct, type IndicatorCandle } from "./confluenceIct";

function candle(time: number, open: number, high: number, low: number, close: number): IndicatorCandle {
  return { time, open, high, low, close, volume: 100 };
}

describe("Confluence ICT V3.4", () => {
  it("ينشئ FVG صاعدًا ويزيله عندما يعود السعر لملء المنطقة", () => {
    const active = calculateConfluenceIct([
      candle(1, 100, 102, 98, 101),
      candle(2, 101, 104, 100, 103),
      candle(3, 105, 108, 105, 107),
    ], { atrFvgMin: 0, fvgMinTicks: 0 });
    expect(active.zones.some(zone => zone.kind === "bullish-fvg" && zone.low === 102 && zone.high === 105)).toBe(true);

    const mitigated = calculateConfluenceIct([
      candle(1, 100, 102, 98, 101),
      candle(2, 101, 104, 100, 103),
      candle(3, 105, 108, 105, 107),
      candle(4, 106, 107, 101, 102),
    ], { atrFvgMin: 0, fvgMinTicks: 0, fillFvgMode: "wick" });
    expect(mitigated.zones.some(zone => zone.kind === "bullish-fvg")).toBe(false);
  });

  it("يسجل CHoCH صاعدًا عند إغلاق يتجاوز Swing High مؤكد", () => {
    const result = calculateConfluenceIct([
      candle(1, 8, 10, 7, 9),
      candle(2, 9, 12, 8, 11),
      candle(3, 10, 11, 8, 9),
      candle(4, 11, 14, 10, 13),
    ], { swingLength: 1, atrFvgMin: 10 });
    expect(result.events.some(event => event.kind === "bullish-choch")).toBe(true);
  });

  it("يسجل المؤشر في السجل القابل للتوسع ويعيد ملخصًا متزنًا للبيانات القصيرة", () => {
    const result = CHART_INDICATOR_REGISTRY["confluence-ict-v3-4"].calculate([candle(1, 10, 11, 9, 10)]);
    expect(result.id).toBe("confluence-ict-v3-4");
    expect(result.lines).toHaveLength(3);
    expect(result.summary.signal).toBe("WAIT");
  });
});

import { describe, expect, it } from "vitest";
import {
  analyzeMarketStructure,
  derivePriceLevels,
  detectStructureEvents,
  detectSwingPoints,
  type PriceLevel,
  type StructureCandle,
} from "@shared/marketStructure";

const candles: StructureCandle[] = [
  { time: 1, open: 100, high: 102, low: 98, close: 101 },
  { time: 2, open: 101, high: 105, low: 99, close: 104 },
  { time: 3, open: 104, high: 110, low: 102, close: 106 },
  { time: 4, open: 106, high: 107, low: 96, close: 98 },
  { time: 5, open: 98, high: 101, low: 90, close: 96 },
  { time: 6, open: 96, high: 108, low: 94, close: 107 },
  { time: 7, open: 107, high: 114, low: 105, close: 112 },
  { time: 8, open: 112, high: 113, low: 104, close: 106 },
  { time: 9, open: 106, high: 107, low: 88, close: 89 },
];

describe("محرك بنية السعر", () => {
  it("يستخرج قممًا وقيعانًا متأرجحة مؤكدة", () => {
    const swings = detectSwingPoints(candles, 1);
    expect(swings).toEqual(expect.arrayContaining([
      expect.objectContaining({ time: 3, kind: "high", price: 110 }),
      expect.objectContaining({ time: 5, kind: "low", price: 90 }),
    ]));
  });

  it("يبني دعمًا ومقاومة مع مستوى إبطال لكل منهما", () => {
    const levels = derivePriceLevels(detectSwingPoints(candles, 1));
    const resistance = levels.find(level => level.kind === "resistance");
    const support = levels.find(level => level.kind === "support");
    expect(resistance).toMatchObject({ price: 110, touches: 1 });
    expect(resistance?.invalidation).toBeGreaterThan(resistance?.price ?? 0);
    expect(support).toMatchObject({ price: 90, touches: 1 });
    expect(support?.invalidation).toBeLessThan(support?.price ?? Infinity);
  });

  it("يسجل الاختراق والهبوط عند إغلاق يتجاوز المستوى وليس بمجرد ذيل", () => {
    const levels = derivePriceLevels(detectSwingPoints(candles, 1));
    const events = detectStructureEvents(candles, levels);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "bullish-breakout", time: 7, level: 110 }),
      expect.objectContaining({ kind: "bearish-breakdown", time: 9, level: 90 }),
    ]));
  });

  it("يتعرف على انعكاس هابط عند فشل اختراق المقاومة والعودة للإغلاق أسفلها", () => {
    const levels = derivePriceLevels(detectSwingPoints(candles, 1));
    const events = detectStructureEvents(candles, levels);
    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "bearish-reversal",
        time: 8,
        level: 110,
        explanation: expect.stringContaining("فشل الاختراق"),
      }),
    ]));
  });

  it("يتعرف على انعكاس صاعد عند فشل كسر الدعم والعودة للإغلاق فوقه", () => {
    const support: PriceLevel = {
      id: "support-test",
      kind: "support",
      price: 100,
      touches: 1,
      createdAt: 0,
      invalidation: 99,
    };
    const events = detectStructureEvents([
      { time: 1, open: 101, high: 102, low: 100, close: 101 },
      { time: 2, open: 101, high: 102, low: 96, close: 98 },
      { time: 3, open: 98, high: 104, low: 97, close: 103 },
    ], [support]);

    expect(events).toEqual(expect.arrayContaining([
      expect.objectContaining({
        kind: "bullish-reversal",
        time: 3,
        level: 100,
        explanation: expect.stringContaining("فشل الكسر"),
      }),
    ]));
  });

  it("يستخرج مناطق عرض وطلب فقط بعد تأكيد اندفاع لاحق", () => {
    const structure = analyzeMarketStructure(candles, { swingRadius: 1, confirmationBars: 2 });
    expect(structure.zones).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "demand", createdAt: 5, state: "fresh" }),
      expect.objectContaining({ kind: "supply", createdAt: 3, state: "fresh" }),
    ]));
  });
});

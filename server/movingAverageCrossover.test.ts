import { describe, expect, it } from "vitest";
import { findLatestSmaCrossover } from "@shared/movingAverageCrossover";

function candlesFromCloses(closes: number[]) {
  return closes.map((close, index) => ({ time: 1_700_000_000 + index * 3_600, close }));
}

describe("findLatestSmaCrossover", () => {
  it("يلتقط التقاطع الذهبي عند عبور SMA 20 فوق SMA 50", () => {
    const crossover = findLatestSmaCrossover(candlesFromCloses([...Array(50).fill(100), ...Array(20).fill(120)]));

    expect(crossover).toMatchObject({
      kind: "golden",
      price: 120,
      fastPeriod: 20,
      slowPeriod: 50,
    });
    expect(crossover?.barsSince).toBeGreaterThanOrEqual(0);
  });

  it("يلتقط تقاطع الموت عند هبوط SMA 20 دون SMA 50", () => {
    const crossover = findLatestSmaCrossover(candlesFromCloses([...Array(50).fill(100), ...Array(20).fill(80)]));

    expect(crossover).toMatchObject({
      kind: "death",
      price: 80,
      fastPeriod: 20,
      slowPeriod: 50,
    });
  });

  it("لا يعلن تقاطعًا عندما لا تتوافر بيانات كافية أو يبقى الترتيب ثابتًا", () => {
    expect(findLatestSmaCrossover(candlesFromCloses(Array(50).fill(100)))).toBeNull();
    expect(findLatestSmaCrossover(candlesFromCloses(Array(90).fill(100)))).toBeNull();
  });
});

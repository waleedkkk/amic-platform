import { describe, expect, it } from "vitest";
import { calculatePearsonCorrelation, correlationFromCandles } from "../shared/correlation";

describe("Pearson correlation", () => {
  it("يعيد ارتباطًا موجبًا وسالبًا مثاليين لقيم معلومة", () => {
    expect(calculatePearsonCorrelation([1, 2, 3, 4], [2, 4, 6, 8])).toBeCloseTo(1, 8);
    expect(calculatePearsonCorrelation([1, 2, 3, 4], [8, 6, 4, 2])).toBeCloseTo(-1, 8);
  });

  it("يحاذي الشموع زمنيًا ويحسب الارتباط من عوائد الإغلاق فقط", () => {
    const left = [100, 110, 121, 133.1].map((close, index) => ({ time: index + 1, close }));
    const right = [50, 55, 60.5, 66.55].map((close, index) => ({ time: index + 1, close }));
    expect(correlationFromCandles(left, right)).toEqual({ value: 1, sampleSize: 3 });
  });
});

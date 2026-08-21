import { describe, expect, it } from "vitest";
import { getSparklineGeometry } from "./Sparkline";

describe("getSparklineGeometry", () => {
  it("يرسم نقاطًا متناسبة لاتجاه صاعد", () => {
    expect(getSparklineGeometry([10, 20, 15])).toEqual({
      points: "4,44 64,4 124,24",
      direction: "up",
    });
  });

  it("يرسم خطًا أفقيًا لقيم ثابتة دون قسمة على صفر", () => {
    expect(getSparklineGeometry([25, 25])).toEqual({
      points: "4,24 124,24",
      direction: "flat",
    });
  });

  it("لا يرسم مخططًا عند عدم وجود نقطتين صالحتين", () => {
    expect(getSparklineGeometry([Number.NaN, 30])).toBeNull();
  });
});

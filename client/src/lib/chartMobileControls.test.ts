import { describe, expect, it } from "vitest";
import { countEnabledIctLayers, ICT_LAYER_CONTROLS } from "./chartMobileControls";

describe("قائمة طبقات المخطط المبسطة للهاتف", () => {
  it("تحافظ على أدوات ICT الست داخل القائمة الموحدة", () => {
    expect(ICT_LAYER_CONTROLS.map(control => control.key)).toEqual(["trend", "structure", "liquidity", "zones", "signals", "summary"]);
  });

  it("تعرض عدد الطبقات المفعلة بدقة على زر القائمة", () => {
    expect(countEnabledIctLayers({ trend: true, structure: false, liquidity: true, zones: false, signals: true, summary: true })).toBe(4);
  });
});

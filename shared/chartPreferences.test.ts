import { describe, expect, it } from "vitest";
import { DEFAULT_CHART_LAYERS, normalizeChartLayers } from "./chartPreferences";

describe("normalizeChartLayers", () => {
  it("يعيد الإعدادات الافتراضية عند تمرير قيمة غير صالحة", () => {
    expect(normalizeChartLayers(null)).toEqual(DEFAULT_CHART_LAYERS);
  });

  it("يحتفظ بقيم طبقات المستخدم ويتجاهل المفاتيح غير المعروفة", () => {
    expect(normalizeChartLayers({ sma: false, zones: false, unexpected: true })).toEqual({
      ...DEFAULT_CHART_LAYERS,
      sma: false,
      zones: false,
    });
  });
});

import { describe, expect, it } from "vitest";
import { DEFAULT_CHART_LAYERS, chartLayerColorWithOpacity, normalizeChartLayerStyles, normalizeChartLayers, normalizeChartPreferences } from "../shared/chartPreferences";

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

  it("يرحل تفضيلات الطبقات القديمة إلى عقد Confluence ICT الجديد", () => {
    const result = normalizeChartPreferences({ volume: false, zones: true });
    expect(result.layers.volume).toBe(false);
    expect(result.confluenceIct.enabled).toBe(true);
    expect(result.confluenceIct.settings.mode).toBe("normal");
  });

  it("يحافظ على إعداد Confluence ICT المخزن لكل مستخدم", () => {
    const result = normalizeChartPreferences({
      layers: { ...DEFAULT_CHART_LAYERS, volume: false },
      confluenceIct: { enabled: true, trend: false, structure: true, liquidity: true, zones: true, signals: true, summary: true, settings: { mode: "scalping", preset: "aggressive" } },
    });
    expect(result.layers.volume).toBe(false);
    expect(result.confluenceIct.trend).toBe(false);
    expect(result.confluenceIct.settings).toMatchObject({ mode: "scalping", preset: "aggressive" });
  });

  it("يحفظ ويستعيد تفضيل المقياس اللوغاريتمي مع رفض القيم غير الصالحة", () => {
    expect(normalizeChartPreferences({ priceScaleMode: "logarithmic" }).priceScaleMode).toBe("logarithmic");
    expect(normalizeChartPreferences({ priceScaleMode: "unsupported" }).priceScaleMode).toBe("normal");
  });

  it("يطبع ألوان وشفافية الطبقات ويرفض اللون أو الشفافية غير الصالحين", () => {
    expect(normalizeChartLayerStyles({ colors: { sma20: "#ABCDEF", ema12: "red" }, opacity: { trend: 0.4, zones: 10 } })).toMatchObject({
      colors: { sma20: "#abcdef" },
      opacity: { trend: 0.4, zones: 1 },
    });
    expect(chartLayerColorWithOpacity("#abcdef", 0.4)).toBe("rgba(171,205,239,0.4)");
  });

  it("يرحل التفضيلات القديمة بإضافة مظهر الطبقات الافتراضي", () => {
    const result = normalizeChartPreferences({ layers: DEFAULT_CHART_LAYERS });
    expect(result.layerStyles.colors.sma20).toBe("#f59e0b");
    expect(result.layerStyles.opacity.volume).toBe(0.45);
  });
});

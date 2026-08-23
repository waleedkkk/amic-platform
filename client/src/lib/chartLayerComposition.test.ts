import { describe, expect, it } from "vitest";
import { DEFAULT_CHART_PREFERENCES } from "@shared/chartPreferences";
import { isIctChartLayerVisible, isLegacyChartLayerVisible } from "./chartLayerComposition";

describe("تزامن طبقات المخطط", () => {
  it("يبقي طبقة الدعم والطلب العادية مع طبقات ICT المفعلة في الوقت نفسه", () => {
    const preferences = {
      ...DEFAULT_CHART_PREFERENCES,
      layers: { ...DEFAULT_CHART_PREFERENCES.layers, levels: true, zones: true, events: true },
      confluenceIct: { ...DEFAULT_CHART_PREFERENCES.confluenceIct, trend: true, liquidity: true, zones: true, signals: true },
    };
    expect(isLegacyChartLayerVisible(preferences, "levels")).toBe(true);
    expect(isLegacyChartLayerVisible(preferences, "zones")).toBe(true);
    expect(isIctChartLayerVisible(preferences, "trend")).toBe(true);
    expect(isIctChartLayerVisible(preferences, "liquidity")).toBe(true);
    expect(isIctChartLayerVisible(preferences, "signals")).toBe(true);
  });
});

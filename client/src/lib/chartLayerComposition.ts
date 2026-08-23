import type { ChartLayerKey, ChartPreferences, ConfluenceIctDisplayPreferences } from "@shared/chartPreferences";

type IctLayerKey = Exclude<keyof ConfluenceIctDisplayPreferences, "enabled" | "settings">;

/** الطبقات العادية وICT مجموعتان متراكبتان؛ تفعيل واحدة لا يلغي الأخرى. */
export function isLegacyChartLayerVisible(preferences: ChartPreferences, key: ChartLayerKey) {
  return preferences.layers[key];
}

export function isIctChartLayerVisible(preferences: ChartPreferences, key: IctLayerKey) {
  return preferences.confluenceIct.enabled && preferences.confluenceIct[key];
}

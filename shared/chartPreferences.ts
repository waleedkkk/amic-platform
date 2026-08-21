export const chartLayerKeys = ["sma", "ema", "levels", "zones", "events", "volume"] as const;

export type ChartLayerKey = (typeof chartLayerKeys)[number];

export type ChartLayerPreferences = Record<ChartLayerKey, boolean>;

export const DEFAULT_CHART_LAYERS: ChartLayerPreferences = {
  sma: true,
  ema: true,
  levels: true,
  zones: true,
  events: true,
  volume: true,
};

/** يقبل فقط مفاتيح طبقات AMIC المعروفة ويعيد إعدادات صالحة مكتملة. */
export function normalizeChartLayers(value: unknown): ChartLayerPreferences {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ...DEFAULT_CHART_LAYERS };
  const source = value as Record<string, unknown>;
  return chartLayerKeys.reduce<ChartLayerPreferences>((layers, key) => {
    layers[key] = typeof source[key] === "boolean" ? source[key] : DEFAULT_CHART_LAYERS[key];
    return layers;
  }, { ...DEFAULT_CHART_LAYERS });
}

import { DEFAULT_CONFLUENCE_ICT_SETTINGS, type ConfluenceIctSettings } from "./confluenceIct";

/** طبقات AMIC القديمة محفوظة للتوافق فقط؛ الطبقات الافتراضية الآن تستبدلها بـ Confluence ICT. */
export const chartLayerKeys = ["sma", "ema", "levels", "zones", "events", "volume"] as const;
export type ChartLayerKey = (typeof chartLayerKeys)[number];
export type ChartLayerPreferences = Record<ChartLayerKey, boolean>;

export const DEFAULT_CHART_LAYERS: ChartLayerPreferences = {
  sma: false,
  ema: false,
  levels: false,
  zones: false,
  events: false,
  volume: true,
};

export type ConfluenceIctDisplayPreferences = {
  enabled: boolean;
  trend: boolean;
  structure: boolean;
  liquidity: boolean;
  zones: boolean;
  signals: boolean;
  summary: boolean;
  settings: ConfluenceIctSettings;
};

export const DEFAULT_CONFLUENCE_ICT_DISPLAY: ConfluenceIctDisplayPreferences = {
  enabled: true,
  trend: true,
  structure: true,
  liquidity: true,
  zones: true,
  signals: true,
  summary: true,
  settings: { ...DEFAULT_CONFLUENCE_ICT_SETTINGS },
};

export type ChartPreferences = {
  layers: ChartLayerPreferences;
  confluenceIct: ConfluenceIctDisplayPreferences;
  priceScaleMode: "normal" | "logarithmic";
};

export const DEFAULT_CHART_PREFERENCES: ChartPreferences = {
  layers: { ...DEFAULT_CHART_LAYERS },
  confluenceIct: { ...DEFAULT_CONFLUENCE_ICT_DISPLAY, settings: { ...DEFAULT_CONFLUENCE_ICT_SETTINGS } },
  priceScaleMode: "normal",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/** يقبل إعدادات طبقات AMIC القديمة ويعيدها لتوافق الصفوف المخزنة السابقة. */
export function normalizeChartLayers(value: unknown): ChartLayerPreferences {
  if (!isRecord(value)) return { ...DEFAULT_CHART_LAYERS };
  return chartLayerKeys.reduce<ChartLayerPreferences>((layers, key) => {
    layers[key] = typeof value[key] === "boolean" ? value[key] as boolean : DEFAULT_CHART_LAYERS[key];
    return layers;
  }, { ...DEFAULT_CHART_LAYERS });
}

export function normalizeConfluenceIctSettings(value: unknown): ConfluenceIctSettings {
  if (!isRecord(value)) return { ...DEFAULT_CONFLUENCE_ICT_SETTINGS };
  const result = { ...DEFAULT_CONFLUENCE_ICT_SETTINGS } as Record<keyof ConfluenceIctSettings, string | number | boolean>;
  for (const key of Object.keys(DEFAULT_CONFLUENCE_ICT_SETTINGS) as Array<keyof ConfluenceIctSettings>) {
    const candidate = value[key];
    if (typeof candidate === typeof DEFAULT_CONFLUENCE_ICT_SETTINGS[key]) result[key] = candidate as string | number | boolean;
  }
  return result as ConfluenceIctSettings;
}

/** يقبل تخزين الطبقات السابق أو الحمولة الجديدة ويعيد تفضيلات صالحة كاملة. */
export function normalizeChartPreferences(value: unknown): ChartPreferences {
  if (!isRecord(value)) return { ...DEFAULT_CHART_PREFERENCES, layers: { ...DEFAULT_CHART_LAYERS }, confluenceIct: { ...DEFAULT_CONFLUENCE_ICT_DISPLAY, settings: { ...DEFAULT_CONFLUENCE_ICT_SETTINGS } } };
  const legacyLayers = isRecord(value.layers) ? value.layers : value;
  const confluence = isRecord(value.confluenceIct) ? value.confluenceIct : {};
  const displayKeys = ["enabled", "trend", "structure", "liquidity", "zones", "signals", "summary"] as const;
  const normalizedDisplay = displayKeys.reduce<Omit<ConfluenceIctDisplayPreferences, "settings">>((result, key) => {
    result[key] = typeof confluence[key] === "boolean" ? confluence[key] as boolean : DEFAULT_CONFLUENCE_ICT_DISPLAY[key];
    return result;
  }, { enabled: true, trend: true, structure: true, liquidity: true, zones: true, signals: true, summary: true });
  return {
    layers: normalizeChartLayers(legacyLayers),
    confluenceIct: { ...normalizedDisplay, settings: normalizeConfluenceIctSettings(confluence.settings) },
    priceScaleMode: value.priceScaleMode === "logarithmic" ? "logarithmic" : "normal",
  };
}

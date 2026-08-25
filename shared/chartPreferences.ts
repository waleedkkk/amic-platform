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

export const chartLayerColorKeys = [
  "sma20", "sma50", "ema12", "ema26", "support", "resistance", "demand", "supply",
  "ictTrend", "ictBullish", "ictBearish", "buyLiquidity", "sellLiquidity", "volumeUp", "volumeDown",
] as const;
export type ChartLayerColorKey = (typeof chartLayerColorKeys)[number];
export type ChartLayerColors = Record<ChartLayerColorKey, string>;

export const chartLayerOpacityKeys = ["trend", "levels", "zones", "signals", "volume"] as const;
export type ChartLayerOpacityKey = (typeof chartLayerOpacityKeys)[number];
export type ChartLayerOpacity = Record<ChartLayerOpacityKey, number>;
export type ChartLayerStylePreferences = { colors: ChartLayerColors; opacity: ChartLayerOpacity };

export const DEFAULT_CHART_LAYER_STYLES: ChartLayerStylePreferences = {
  colors: {
    sma20: "#f59e0b", sma50: "#a78bfa", ema12: "#38bdf8", ema26: "#34d399",
    support: "#16a34a", resistance: "#dc2626", demand: "#10b981", supply: "#fb7185",
    ictTrend: "#38bdf8", ictBullish: "#22d3ee", ictBearish: "#f472b6",
    buyLiquidity: "#e879f9", sellLiquidity: "#22d3ee", volumeUp: "#16a34a", volumeDown: "#dc2626",
  },
  opacity: { trend: 1, levels: 0.7, zones: 0.62, signals: 0.9, volume: 0.45 },
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
  layerStyles: ChartLayerStylePreferences;
  priceScaleMode: "normal" | "logarithmic";
};

export const DEFAULT_CHART_PREFERENCES: ChartPreferences = {
  layers: { ...DEFAULT_CHART_LAYERS },
  confluenceIct: { ...DEFAULT_CONFLUENCE_ICT_DISPLAY, settings: { ...DEFAULT_CONFLUENCE_ICT_SETTINGS } },
  layerStyles: { colors: { ...DEFAULT_CHART_LAYER_STYLES.colors }, opacity: { ...DEFAULT_CHART_LAYER_STYLES.opacity } },
  priceScaleMode: "normal",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeChartLayerStyles(value: unknown): ChartLayerStylePreferences {
  const candidate = isRecord(value) ? value : {};
  const candidateColors = isRecord(candidate.colors) ? candidate.colors : {};
  const candidateOpacity = isRecord(candidate.opacity) ? candidate.opacity : {};
  const colors = chartLayerColorKeys.reduce<ChartLayerColors>((result, key) => {
    const color = candidateColors[key];
    result[key] = typeof color === "string" && /^#[\da-fA-F]{6}$/.test(color) ? color.toLowerCase() : DEFAULT_CHART_LAYER_STYLES.colors[key];
    return result;
  }, { ...DEFAULT_CHART_LAYER_STYLES.colors });
  const opacity = chartLayerOpacityKeys.reduce<ChartLayerOpacity>((result, key) => {
    const opacityValue = candidateOpacity[key];
    result[key] = typeof opacityValue === "number" && Number.isFinite(opacityValue) ? Math.min(1, Math.max(0.15, opacityValue)) : DEFAULT_CHART_LAYER_STYLES.opacity[key];
    return result;
  }, { ...DEFAULT_CHART_LAYER_STYLES.opacity });
  return { colors, opacity };
}

export function chartLayerColorWithOpacity(color: string, opacity: number) {
  const normalized = /^#[\da-fA-F]{6}$/.test(color) ? color : "#ffffff";
  const red = Number.parseInt(normalized.slice(1, 3), 16);
  const green = Number.parseInt(normalized.slice(3, 5), 16);
  const blue = Number.parseInt(normalized.slice(5, 7), 16);
  return `rgba(${red},${green},${blue},${Math.min(1, Math.max(0.15, opacity))})`;
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
  if (!isRecord(value)) return { ...DEFAULT_CHART_PREFERENCES, layers: { ...DEFAULT_CHART_LAYERS }, confluenceIct: { ...DEFAULT_CONFLUENCE_ICT_DISPLAY, settings: { ...DEFAULT_CONFLUENCE_ICT_SETTINGS } }, layerStyles: normalizeChartLayerStyles(undefined) };
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
    layerStyles: normalizeChartLayerStyles(value.layerStyles),
    priceScaleMode: value.priceScaleMode === "logarithmic" ? "logarithmic" : "normal",
  };
}

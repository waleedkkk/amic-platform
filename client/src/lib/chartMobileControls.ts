import type { ChartPreferences } from "@shared/chartPreferences";

export const ICT_LAYER_CONTROLS = [
  { key: "trend", label: "EMA Trend" },
  { key: "structure", label: "BOS / CHoCH" },
  { key: "liquidity", label: "BSL / SSL" },
  { key: "zones", label: "OB / FVG" },
  { key: "signals", label: "BUY / SELL" },
  { key: "summary", label: "ملخص ICT" },
] as const;

export type IctLayerControlKey = (typeof ICT_LAYER_CONTROLS)[number]["key"];

export function countEnabledIctLayers(layers: Pick<ChartPreferences["confluenceIct"], IctLayerControlKey>) {
  return ICT_LAYER_CONTROLS.filter(control => layers[control.key]).length;
}

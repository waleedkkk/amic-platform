export const ORDER_FLOW_DEPTH_LEVEL_OPTIONS = [5, 10, 20] as const;
export const MIN_LARGE_TRADE_NOTIONAL = 1_000;
export const MAX_LARGE_TRADE_NOTIONAL = 1_000_000;

export type OrderFlowPreferences = {
  largeTradeMinNotional: number;
  depthLevels: (typeof ORDER_FLOW_DEPTH_LEVEL_OPTIONS)[number];
};

export const DEFAULT_ORDER_FLOW_PREFERENCES: OrderFlowPreferences = {
  largeTradeMinNotional: 5_000,
  depthLevels: 20,
};

export function normalizeOrderFlowPreferences(value: unknown): OrderFlowPreferences {
  const record = value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
  const notional = Number(record.largeTradeMinNotional);
  const depth = Number(record.depthLevels);
  return {
    largeTradeMinNotional: Number.isInteger(notional) && notional >= MIN_LARGE_TRADE_NOTIONAL && notional <= MAX_LARGE_TRADE_NOTIONAL
      ? notional
      : DEFAULT_ORDER_FLOW_PREFERENCES.largeTradeMinNotional,
    depthLevels: ORDER_FLOW_DEPTH_LEVEL_OPTIONS.includes(depth as (typeof ORDER_FLOW_DEPTH_LEVEL_OPTIONS)[number])
      ? depth as (typeof ORDER_FLOW_DEPTH_LEVEL_OPTIONS)[number]
      : DEFAULT_ORDER_FLOW_PREFERENCES.depthLevels,
  };
}

export const MARKET_ASSISTANT_CONTEXT_KEY = "amic.market-assistant-context.v2";

export const MARKET_ASSISTANT_CONTEXT_FIELDS = [
  "globalSnapshot",
  "cryptoGainers",
  "cryptoLosers",
  "stockGainers",
  "stockLosers",
  "marketPulse",
] as const;

export type MarketAssistantContext = Record<string, unknown>;

type SessionStorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function isMarketAssistantContext(value: unknown): value is MarketAssistantContext {
  return Boolean(
    value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      MARKET_ASSISTANT_CONTEXT_FIELDS.some(field => Object.prototype.hasOwnProperty.call(value, field)),
  );
}

export function saveMarketAssistantContext(storage: SessionStorageLike, context: MarketAssistantContext) {
  storage.setItem(MARKET_ASSISTANT_CONTEXT_KEY, JSON.stringify(context));
}

export function clearMarketAssistantContext(storage: Pick<Storage, "removeItem">) {
  storage.removeItem(MARKET_ASSISTANT_CONTEXT_KEY);
}

export function consumeMarketAssistantContext(storage: SessionStorageLike): MarketAssistantContext | undefined {
  const rawContext = storage.getItem(MARKET_ASSISTANT_CONTEXT_KEY);
  storage.removeItem(MARKET_ASSISTANT_CONTEXT_KEY);

  if (!rawContext) return undefined;

  try {
    const parsed = JSON.parse(rawContext) as unknown;
    return isMarketAssistantContext(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

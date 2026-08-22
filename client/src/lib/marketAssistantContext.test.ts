import { describe, expect, it } from "vitest";
import {
  clearMarketAssistantContext,
  consumeMarketAssistantContext,
  MARKET_ASSISTANT_CONTEXT_KEY,
  saveMarketAssistantContext,
} from "./marketAssistantContext";

class MemorySessionStorage {
  private values = new Map<string, string>();

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }

  removeItem(key: string) {
    this.values.delete(key);
  }
}

describe("market assistant context", () => {
  it("يحفظ ملخص السوق ثم يستهلكه مرة واحدة", () => {
    const storage = new MemorySessionStorage();
    const context = {
      globalSnapshot: { indices: [{ symbol: "SPX" }] },
      cryptoGainers: [{ symbol: "BTCUSDT", change_pct: 2.1 }],
      cryptoLosers: [],
      stockGainers: [],
      stockLosers: [],
    };

    saveMarketAssistantContext(storage, context);

    expect(consumeMarketAssistantContext(storage)).toEqual(context);
    expect(storage.getItem(MARKET_ASSISTANT_CONTEXT_KEY)).toBeNull();
    expect(consumeMarketAssistantContext(storage)).toBeUndefined();
  });

  it("يتخلص من السياق غير الصالح ولا يمرره إلى المساعد", () => {
    const storage = new MemorySessionStorage();
    storage.setItem(MARKET_ASSISTANT_CONTEXT_KEY, "not-json");

    expect(consumeMarketAssistantContext(storage)).toBeUndefined();
    expect(storage.getItem(MARKET_ASSISTANT_CONTEXT_KEY)).toBeNull();
  });

  it("يمسح السياق عند فتح المساعد دون بيانات سوق صالحة", () => {
    const storage = new MemorySessionStorage();
    storage.setItem(MARKET_ASSISTANT_CONTEXT_KEY, JSON.stringify({ globalSnapshot: {} }));

    clearMarketAssistantContext(storage);

    expect(storage.getItem(MARKET_ASSISTANT_CONTEXT_KEY)).toBeNull();
  });
});

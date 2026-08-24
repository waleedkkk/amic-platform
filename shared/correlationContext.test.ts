import { describe, expect, it } from "vitest";
import { evaluateCorrelationContext, selectCorrelationAssets, type CorrelationObservedAsset } from "./correlationContext";

function observed(id: string, changePercent: number, expectedRelationship: "same" | "inverse" | "context_only" = "same"): CorrelationObservedAsset {
  return {
    id,
    symbol: id.toUpperCase(),
    exchange: "TEST",
    label: id,
    rationale: "اختبار",
    expectedRelationship,
    price: 100,
    changePercent,
    fetchedAt: "2026-08-24T12:00:00.000Z",
    sourceTimestamp: "2026-08-24T12:00:00.000Z",
    provider: "tradingview-mcp",
  };
}

describe("خريطة السياق المترابط", () => {
  it("تختار أصولًا مختلفة للمعادن والفوركس والكربتو بدل قائمة ثابتة واحدة", () => {
    const metal = selectCorrelationAssets({ symbol: "XAUUSD", exchange: "FX" });
    const forex = selectCorrelationAssets({ symbol: "AUDUSD", exchange: "FX" });
    const crypto = selectCorrelationAssets({ symbol: "BTCUSDT", exchange: "BINANCE" });

    expect(metal.assetClass).toBe("metal");
    expect(metal.assets.map(item => item.id)).toEqual(expect.arrayContaining(["dxy", "us10y", "silver", "gdx"]));
    expect(forex.assetClass).toBe("forex");
    expect(forex.assets.map(item => item.id)).toEqual(expect.arrayContaining(["dxy", "us10y", "gold"]));
    expect(crypto.assetClass).toBe("crypto");
    expect(crypto.assets.map(item => item.id)).toEqual(expect.arrayContaining(["btc", "eth", "btc-dominance", "qqq"]));
    expect(metal.assets.map(item => item.id)).not.toEqual(crypto.assets.map(item => item.id));
  });

  it("يصنّف ذهبًا صاعدًا مع دولار هابط كاتساق مع العلاقة العكسية المتوقعة", () => {
    const context = evaluateCorrelationContext({
      instrument: { symbol: "XAUUSD", exchange: "FX" },
      primaryChangePercent: 1.2,
      observedAssets: [
        observed("dxy", -0.4, "inverse"),
        observed("silver", 0.9, "same"),
        observed("gdx", 0.7, "same"),
      ],
      fetchedAt: "2026-08-24T12:00:00.000Z",
    });

    expect(context.assessment).toBe("strong");
    expect(context.items.every(item => item.status === "aligned")).toBe(true);
    expect(context.summary).toContain("توافق قوي");
  });

  it("يصنّف الأصول التي تعاكس العلاقة المتوقعة كتعارض سياقي", () => {
    const context = evaluateCorrelationContext({
      instrument: { symbol: "XAUUSD", exchange: "FX" },
      primaryChangePercent: 1.2,
      observedAssets: [
        observed("dxy", 0.4, "inverse"),
        observed("silver", -0.9, "same"),
      ],
    });

    expect(context.assessment).toBe("conflicted");
    expect(context.items.every(item => item.status === "divergent")).toBe(true);
  });
});

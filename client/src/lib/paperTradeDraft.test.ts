import { describe, expect, it } from "vitest";
import { makeAnalysisTradeDraft, suggestRiskLevels } from "./paperTradeDraft";

describe("suggestRiskLevels", () => {
  it("uses the nearest valid support and resistance for a long draft", () => {
    expect(suggestRiskLevels("long", 100, { supportLevels: [96, 92], resistanceLevels: [108, 115] })).toMatchObject({
      stopLoss: "95.71",
      takeProfit: "108.00",
      basis: "مستويات الدعم/المقاومة المتاحة",
    });
  });

  it("uses the nearest valid resistance and support for a short draft", () => {
    expect(suggestRiskLevels("short", 100, { supportLevels: [94, 90], resistanceLevels: [104, 110] })).toMatchObject({
      stopLoss: "104.31",
      takeProfit: "94.00",
      basis: "مستويات الدعم/المقاومة المتاحة",
    });
  });

  it("falls back to a conservative two-to-one risk reward when no usable levels exist", () => {
    const draft = makeAnalysisTradeDraft({ symbol: "BTCUSDT", exchange: "BINANCE", recommendation: "buy", price: 100, note: "اختبار" });
    expect(draft).toMatchObject({ side: "long", stopLoss: "98.00", takeProfit: "104.00" });
    expect(draft?.note).toContain("قابلين للتعديل");
  });
});

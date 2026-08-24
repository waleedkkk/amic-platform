import { describe, expect, it } from "vitest";
import { assessTradeDecisionReadiness, assessTradeRisk, makeAnalysisTradeDraft, suggestRiskLevels } from "./paperTradeDraft";

describe("suggestRiskLevels", () => {
  it("uses the nearest valid support and resistance for a long draft", () => {
    expect(suggestRiskLevels("long", 100, { supportLevels: [96, 92], resistanceLevels: [108, 115] })).toMatchObject({
      stopLoss: "95.71",
      takeProfit: "108.00",
      basis: "مستويات الدعم/المقاومة المتاحة",
      stopLossSource: { kind: "support", level: 96 },
      takeProfitSource: { kind: "resistance", level: 108 },
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

  it("يحافظ على معرّف الإشارة المصدرية عند تحويل التحليل إلى مسودة", () => {
    const draft = makeAnalysisTradeDraft({ symbol: "BTCUSDT", exchange: "BINANCE", recommendation: "buy", price: 100, note: "اختبار", signalId: 41 });

    expect(draft?.signalId).toBe(41);
  });

  it("calculates risk reward and warns when long risk levels are reversed", () => {
    expect(assessTradeRisk({ side: "long", entryPrice: "100", stopLoss: "95", takeProfit: "110" })).toMatchObject({ riskRewardRatio: 2, warnings: [] });
    expect(assessTradeRisk({ side: "long", entryPrice: "100", stopLoss: "101", takeProfit: "99" }).warnings).toEqual([
      "للشراء، يجب أن يكون وقف الخسارة أقل من سعر الدخول.",
      "للشراء، يجب أن يكون جني الربح أعلى من سعر الدخول.",
    ]);
  });

  it("warns when short risk levels are reversed", () => {
    expect(assessTradeRisk({ side: "short", entryPrice: "100", stopLoss: "99", takeProfit: "101" }).warnings).toEqual([
      "للبيع، يجب أن يكون وقف الخسارة أعلى من سعر الدخول.",
      "للبيع، يجب أن يكون جني الربح أقل من سعر الدخول.",
    ]);
  });

  it("يصف الجاهزية دون توصية ويكشف العناصر الناقصة أو القيم التي تحتاج تصحيحًا", () => {
    expect(assessTradeDecisionReadiness({ symbol: "XAUUSD", exchange: "FX", side: "long", quantity: "1", entryPrice: "4000", stopLoss: "3990", takeProfit: "4020" })).toMatchObject({ status: "ready", riskRewardRatio: 2 });
    expect(assessTradeDecisionReadiness({ symbol: "", exchange: "FX", side: "long", quantity: "", entryPrice: "", stopLoss: "", takeProfit: "" })).toMatchObject({ status: "incomplete", missing: expect.arrayContaining(["الرمز", "الكمية الموجبة", "سعر الدخول"]) });
    expect(assessTradeDecisionReadiness({ symbol: "XAUUSD", exchange: "FX", side: "long", quantity: "1", entryPrice: "4000", stopLoss: "4010", takeProfit: "3990" })).toMatchObject({ status: "needs_correction" });
  });
});

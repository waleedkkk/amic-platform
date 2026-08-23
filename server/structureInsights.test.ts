import { describe, expect, it } from "vitest";
import { explainPriceLevel, explainPriceZone } from "../shared/structureInsights";

describe("تفسير المستويات والمناطق", () => {
  it("يشرح قوة الدعم وحد الإبطال ومسافته للذهب", () => {
    const insight = explainPriceLevel({ id: "support-1", kind: "support", price: 4000, touches: 3, createdAt: 1_700_000_000, invalidation: 3990 }, 4005, "XAUUSD", "FX");
    expect(insight).toMatchObject({ title: "دعم متجمع", strength: "strong", strengthLabel: "قوي", distanceToInvalidation: 1500, distanceUnit: "نقطة سعرية" });
  });

  it("يشرح حالة منطقة العرض ومسافة إبطالها بالنقاط لزوج فوركس", () => {
    const insight = explainPriceZone({ id: "supply-1", kind: "supply", low: 1.1, high: 1.11, createdAt: 1_700_000_000, state: "tested", invalidation: 1.111 }, 1.103, "EURUSD", "FX");
    expect(insight).toMatchObject({ title: "منطقة عرض", strength: "moderate", strengthLabel: "مختبرة", distanceToInvalidation: 80, distanceUnit: "pips" });
  });
});

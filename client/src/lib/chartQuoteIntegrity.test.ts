import { describe, expect, it } from "vitest";
import { shouldMergeLiveQuoteIntoLastCandle } from "./chartQuoteIntegrity";

describe("حماية دمج الاقتباس الحي في الشموع", () => {
  it("يرفض خلط اقتباس spot للذهب مع تاريخ Yahoo الاحتياطي للعقود", () => {
    expect(shouldMergeLiveQuoteIntoLastCandle({ symbol: "XAUUSD", sourceRole: "fallback", latestCandleClose: 3394.35, liveQuotePrice: 4621 })).toBe(false);
  });

  it("يسمح بالتحديث المتسق من المصدر الأساسي ويرفض القفزة غير المعقولة", () => {
    expect(shouldMergeLiveQuoteIntoLastCandle({ symbol: "XAUUSD", sourceRole: "primary", latestCandleClose: 3400, liveQuotePrice: 3402.5 })).toBe(true);
    expect(shouldMergeLiveQuoteIntoLastCandle({ symbol: "XAUUSD", sourceRole: "primary", latestCandleClose: 3400, liveQuotePrice: 4621 })).toBe(false);
  });
});

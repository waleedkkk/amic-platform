import { describe, expect, it } from "vitest";
import { DEFAULT_MARKET_PULSE_SECTIONS, DEFAULT_MARKET_PULSE_WIDGETS, normalizeMarketPulsePreferences, normalizeMarketPulseSections } from "./marketPulsePreferences";

describe("normalizeMarketPulseSections", () => {
  it("يعيد الأقسام الافتراضية عند غياب التفضيل أو كونه فارغًا", () => {
    expect(normalizeMarketPulseSections(null)).toEqual(DEFAULT_MARKET_PULSE_SECTIONS);
    expect(normalizeMarketPulseSections([])).toEqual(DEFAULT_MARKET_PULSE_SECTIONS);
  });

  it("يحفظ الأقسام المسموح بها فقط دون تكرار", () => {
    expect(normalizeMarketPulseSections(["stockLosers", "cryptoGainers", "stockLosers", "unknown"])).toEqual(["stockLosers", "cryptoGainers"]);
  });

  it("يحوّل صفيف الأقسام القديم إلى تفضيل موسع مع الوحدات الافتراضية", () => {
    expect(normalizeMarketPulsePreferences(["stockLosers", "stockLosers", "unknown"])).toEqual({
      sections: ["stockLosers"],
      widgets: DEFAULT_MARKET_PULSE_WIDGETS,
    });
  });

  it("يطبع إعدادات التخصيص الموسعة ويحذف الخيارات غير المعروفة والتكرار", () => {
    expect(normalizeMarketPulsePreferences({
      sections: ["cryptoGainers", "cryptoGainers", "bad"],
      widgets: ["summary", "summary", "not-a-widget"],
    })).toEqual({
      sections: ["cryptoGainers"],
      widgets: ["summary"],
    });
  });
});

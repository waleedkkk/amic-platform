import { describe, expect, it } from "vitest";
import { DEFAULT_MARKET_PULSE_SECTIONS, normalizeMarketPulseSections } from "./marketPulsePreferences";

describe("normalizeMarketPulseSections", () => {
  it("يعيد الأقسام الافتراضية عند غياب التفضيل أو كونه فارغًا", () => {
    expect(normalizeMarketPulseSections(null)).toEqual(DEFAULT_MARKET_PULSE_SECTIONS);
    expect(normalizeMarketPulseSections([])).toEqual(DEFAULT_MARKET_PULSE_SECTIONS);
  });

  it("يحفظ الأقسام المسموح بها فقط دون تكرار", () => {
    expect(normalizeMarketPulseSections(["stockLosers", "cryptoGainers", "stockLosers", "unknown"])).toEqual(["stockLosers", "cryptoGainers"]);
  });
});

import { describe, expect, it } from "vitest";
import { describeLiveProviderStatus } from "./liveProviderStatus";

describe("describeLiveProviderStatus", () => {
  it("يظهر أن المزود الحي متصل مع اسمه", () => {
    expect(describeLiveProviderStatus("live", "twelve-data").label).toContain("Twelve Data");
    expect(describeLiveProviderStatus("live", "twelve-data").label).toContain("بث حي");
  });

  it("يوضح أن Binance يحدّث الشمعة الحالية عبر البث الحي", () => {
    expect(describeLiveProviderStatus("live", "binance").label).toContain("للشمعة");
  });

  it("يعرض حالة الاتصال الأولي بوضوح", () => {
    const presentation = describeLiveProviderStatus("connecting", "twelve-data");
    expect(presentation.label).toContain("جارٍ وصل");
    expect(presentation.className).toContain("text-sky-300");
  });

  it("يفصل حالة إعادة الاتصال عن عدم توفر المفتاح", () => {
    expect(describeLiveProviderStatus("reconnecting", "twelve-data").label).toContain("يعيد الاتصال");
    expect(describeLiveProviderStatus("unavailable", "twelve-data").label).toContain("غير متاح");
  });

  it("يوضح التأخر عندما يُستخدم التحديث الدوري بدل بث حي", () => {
    const presentation = describeLiveProviderStatus("delayed", "binance");
    expect(presentation.label).toContain("متأخر");
    expect(presentation.label).toContain("Binance");
    expect(presentation.className).toContain("text-amber-300");
  });
});

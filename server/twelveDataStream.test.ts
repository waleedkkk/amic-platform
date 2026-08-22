import { describe, expect, it } from "vitest";
import { getReconnectDelay, parseTwelveDataPriceMessage, resolveLiveProviderStatus } from "./twelveDataStream";

describe("Twelve Data stream message parser", () => {
  it("يحوّل رسالة سعر صالحة إلى قيمة رقمية", () => {
    expect(parseTwelveDataPriceMessage('{"symbol":"XAU/USD","price":"2350.42"}')).toEqual({ symbol: "XAU/USD", price: 2350.42 });
  });

  it("يرفض الرسائل الناقصة أو غير الصالحة", () => {
    expect(parseTwelveDataPriceMessage('{"symbol":"EUR/USD"}')).toBeNull();
    expect(parseTwelveDataPriceMessage("not-json")).toBeNull();
  });
});

describe("حالة بث Twelve Data", () => {
  it("يستخدم تأخيرًا متدرجًا محدودًا عند الانقطاع", () => {
    expect(getReconnectDelay(1)).toBe(2_500);
    expect(getReconnectDelay(2)).toBe(5_000);
    expect(getReconnectDelay(8)).toBe(30_000);
  });

  it("يعرض الحالة المتأخرة بدل سعر قديم", () => {
    expect(resolveLiveProviderStatus("live", 1_000, 21_001)).toBe("delayed");
    expect(resolveLiveProviderStatus("reconnecting", 1_000, 21_001)).toBe("reconnecting");
  });
});

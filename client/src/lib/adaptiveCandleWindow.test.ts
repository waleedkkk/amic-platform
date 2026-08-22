import { describe, expect, it } from "vitest";
import { getAdaptiveCandleLimit, getChartViewportHeight, shouldLoadChartData } from "./adaptiveCandleWindow";

describe("getAdaptiveCandleLimit", () => {
  it("يحافظ على حد أدنى يكفي للمؤشرات على الشاشات الضيقة", () => {
    expect(getAdaptiveCandleLimit(320)).toBe(180);
  });

  it("يزيد عدد الشموع مع اتساع مساحة المخطط", () => {
    expect(getAdaptiveCandleLimit(768)).toBe(256);
    expect(getAdaptiveCandleLimit(1280)).toBe(427);
  });

  it("يطبق سقفًا يمنع تضخم البيانات على الشاشات الواسعة", () => {
    expect(getAdaptiveCandleLimit(2000)).toBe(440);
    expect(getAdaptiveCandleLimit(0)).toBe(180);
  });
});

describe("shouldLoadChartData", () => {
  it("يتطلب رمزًا وبورصة صالحين للبيانات السوقية العامة", () => {
    expect(shouldLoadChartData("", "BINANCE")).toBe(false);
    expect(shouldLoadChartData("BTCUSDT", " ")).toBe(false);
    expect(shouldLoadChartData("BTCUSDT", "BINANCE")).toBe(true);
  });
});

describe("getChartViewportHeight", () => {
  it("يطابق ارتفاع حاوية الهاتف ويستخدم ارتفاعًا احتياطيًا آمنًا", () => {
    expect(getChartViewportHeight(300)).toBe(300);
    expect(getChartViewportHeight(379.6)).toBe(380);
    expect(getChartViewportHeight(0)).toBe(300);
  });
});

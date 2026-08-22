import { describe, expect, it } from "vitest";
import { getAdaptiveCandleLimit, getChartViewportHeight, shouldLoadChartData } from "./adaptiveCandleWindow";
import { getChartOverlayDensity } from "./chartOverlayDensity";

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

describe("getChartOverlayDensity", () => {
  it("يحد تسميات السعر الكثيفة على شاشة الهاتف مع إبقاء خطوط المستويات مرئية", () => {
    expect(getChartOverlayDensity(320)).toEqual({
      compact: true,
      levelLimit: 2,
      zoneLimit: 2,
      showZoneAxisLabels: false,
      showProposalAxisLabels: false,
    });
  });

  it("يعيد كل تسميات المستويات والمناطق في مساحة المخطط المكتبية", () => {
    expect(getChartOverlayDensity(768)).toEqual({
      compact: false,
      levelLimit: 6,
      zoneLimit: 4,
      showZoneAxisLabels: true,
      showProposalAxisLabels: true,
    });
  });
});

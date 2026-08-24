import { describe, expect, it } from "vitest";
import { getAdaptiveCandleLimit, getChartViewportHeight, shouldLoadChartData } from "./adaptiveCandleWindow";
import { getChartOverlayDensity } from "./chartOverlayDensity";
import { selectMostRecentOverlays } from "./chartOverlaySelection";

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
  it("يخفي تسميات المحور الكثيفة على شاشة الهاتف من دون تقليص طبقات المستخدم", () => {
    expect(getChartOverlayDensity(320)).toEqual({
      compact: true,
      levelLimit: 6,
      zoneLimit: 4,
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

  it("يثبت الطبقات المختارة عند التكبير والتصغير الشديدين مع تغيير حد الشموع فقط", () => {
    const overlays = Array.from({ length: 8 }, (_, index) => ({ id: `overlay-${index + 1}`, createdAt: index + 1 }));
    const widths = [160, 320, 559, 560, 768, 1440, 3_200];
    const baseline = selectMostRecentOverlays(overlays, getChartOverlayDensity(widths[0]).levelLimit).map(item => item.id);

    for (const width of widths) {
      const density = getChartOverlayDensity(width);
      expect(selectMostRecentOverlays(overlays, density.levelLimit).map(item => item.id)).toEqual(baseline);
      expect(density.levelLimit).toBe(6);
      expect(density.zoneLimit).toBe(4);
      expect(getAdaptiveCandleLimit(width)).toBeGreaterThanOrEqual(180);
    }
  });
});

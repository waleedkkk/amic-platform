import { describe, expect, it } from "vitest";
import { getCacheChartData, getServiceChartData } from "./adminOperationsCharts";

describe("admin operations chart mappers", () => {
  it("يعكس فئات كاش السوق الفعلية فقط ويحمي من القيم السالبة", () => {
    expect(getCacheChartData({ cachedSnapshots: 10, freshSnapshots: 6, retainedSnapshots: 3, cleanupEligibleSnapshots: -1 })).toEqual([
      { key: "fresh", name: "صالحة حاليًا", value: 6, fill: "#34d399" },
      { key: "retained", name: "ضمن نافذة الاحتفاظ", value: 3, fill: "#fbbf24" },
      { key: "cleanup", name: "مؤهلة للتنظيف", value: 0, fill: "#fb7185" },
    ]);
  });

  it("يعرض حالة الخدمة من التهيئة واللقطات الصالحة دون افتراض توفر خدمة", () => {
    const rows = getServiceChartData({
      ai: { activeProvider: null },
      cleanup: { registered: true },
      marketCache: { cachedSnapshots: 4, freshSnapshots: 0, retainedSnapshots: 3, cleanupEligibleSnapshots: 1 },
    });

    expect(rows.map(row => [row.key, row.value, row.status])).toEqual([
      ["ai", 0, "غير مهيأ"],
      ["cleanup", 1, "مجدول"],
      ["market", 0, "لا توجد لقطات صالحة"],
    ]);
  });
});

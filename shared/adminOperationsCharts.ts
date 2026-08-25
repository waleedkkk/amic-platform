export type MarketCacheSummary = {
  cachedSnapshots: number;
  freshSnapshots: number;
  retainedSnapshots: number;
  cleanupEligibleSnapshots: number;
};

export type AdminServiceSummary = {
  ai: { activeProvider: unknown | null };
  cleanup: { registered: boolean };
  marketCache: MarketCacheSummary;
};

const toSafeCount = (value: number) => Math.max(0, Number.isFinite(value) ? value : 0);

/** يحوّل الأرقام المجمعة الحقيقية إلى فئات يمكن الرسم منها، من دون اختراع قيم تاريخية. */
export function getCacheChartData(cache: MarketCacheSummary) {
  return [
    { key: "fresh", name: "صالحة حاليًا", value: toSafeCount(cache.freshSnapshots), fill: "#34d399" },
    { key: "retained", name: "ضمن نافذة الاحتفاظ", value: toSafeCount(cache.retainedSnapshots), fill: "#fbbf24" },
    { key: "cleanup", name: "مؤهلة للتنظيف", value: toSafeCount(cache.cleanupEligibleSnapshots), fill: "#fb7185" },
  ];
}

/** حالات ثنائية مشتقة من التهيئة والبيانات الحية؛ لا تمثل اختبار اتصال خارجي. */
export function getServiceChartData(summary: AdminServiceSummary) {
  return [
    { key: "ai", name: "المساعد الذكي", value: summary.ai.activeProvider ? 1 : 0, status: summary.ai.activeProvider ? "مهيأ" : "غير مهيأ" },
    { key: "cleanup", name: "تنظيف الكاش", value: summary.cleanup.registered ? 1 : 0, status: summary.cleanup.registered ? "مجدول" : "غير مجدول" },
    { key: "market", name: "كاش سوق صالح", value: toSafeCount(summary.marketCache.freshSnapshots) > 0 ? 1 : 0, status: toSafeCount(summary.marketCache.freshSnapshots) > 0 ? "توجد لقطات صالحة" : "لا توجد لقطات صالحة" },
  ];
}

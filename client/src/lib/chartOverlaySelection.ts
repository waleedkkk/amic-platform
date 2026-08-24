type TimestampedOverlay = { createdAt: number };

/**
 * يحافظ على أحدث طبقات السياق بدل الاعتماد على ترتيب المصفوفة الخام،
 * لأن تحميل شموع أقدم عند السحب يعيد أحيانًا ترتيب مستويات البنية حسب السعر.
 */
export function selectMostRecentOverlays<T extends TimestampedOverlay>(items: T[], limit: number): T[] {
  return [...items]
    .sort((left, right) => right.createdAt - left.createdAt)
    .slice(0, Math.max(0, limit));
}

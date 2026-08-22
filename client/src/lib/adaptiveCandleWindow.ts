/**
 * يضمن حدًا تاريخيًا كافيًا للمؤشرات وبنية السعر، دون جلب آلاف الشموع
 * التي لن تكون قابلة للقراءة داخل مساحة المخطط الحالية.
 */
export function getAdaptiveCandleLimit(chartWidth: number): number {
  const measuredWidth = Number.isFinite(chartWidth) && chartWidth > 0 ? chartWidth : 540;
  return Math.min(440, Math.max(180, Math.ceil(measuredWidth / 3)));
}

/** يطابق ارتفاع Canvas ارتفاع الحاوية المرئية ويمنع امتداد الرسم خارج بطاقة المخطط. */
export function getChartViewportHeight(containerHeight: number): number {
  return Number.isFinite(containerHeight) && containerHeight > 0 ? Math.round(containerHeight) : 300;
}

/** يمنع طلب بيانات المخطط المحمية قبل اكتمال تسجيل الدخول أو عند نقص تعريف الأصل. */
export function shouldLoadChartData(symbol: string, exchange: string) {
  return Boolean(symbol.trim()) && Boolean(exchange.trim());
}

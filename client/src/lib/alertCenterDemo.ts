export type AlertCenterDemoItem = {
  id: number;
  category: "metal_alert" | "structure_alert" | "structure_context_alert";
  title: string;
  content: string;
  metadata: Record<string, unknown>;
  readAt: Date | null;
  createdAt: Date;
};

export const LOCAL_ALERT_DEMO_ACCOUNT = {
  name: "حساب المعاينة المحلي",
  email: "demo-alerts@amic.local",
};

export function getLocalAlertCenterDemoItems(): AlertCenterDemoItem[] {
  return [
    { id: 9001, category: "structure_context_alert", title: "اقترب الذهب من منطقة الطلب", content: "وصل السعر إلى نطاق الاقتراب المحدد لمنطقة الطلب. راجع بنية الشموع والسياق متعدد الأطر قبل اتخاذ أي قرار.", metadata: { symbol: "XAUUSD", exchange: "FX", interval: "1h", event: "approach", status: "triggered" }, readAt: null, createdAt: new Date("2026-08-23T11:42:00.000Z") },
    { id: 9002, category: "metal_alert", title: "تحقق تنبيه مستوى الفضة", content: "تجاوزت الفضة مستوى المتابعة الذي أُنشئ للحساب التجريبي. هذه ملاحظة سعرية وليست تأكيدًا لاتجاه أو نتيجة صفقة.", metadata: { symbol: "XAGUSD", exchange: "FX", interval: "4h", event: "touch", status: "triggered" }, readAt: null, createdAt: new Date("2026-08-23T09:18:00.000Z") },
    { id: 9003, category: "structure_alert", title: "تسجيل كسر بنية لزوج اليورو/دولار", content: "سجل النظام حدث كسر بنية وفق القاعدة المحفوظة. استخدم صفحة التحليل للتحقق من المصدر والإطار الزمني.", metadata: { symbol: "EURUSD", exchange: "FX", interval: "1h", event: "breakout", status: "recorded" }, readAt: new Date("2026-08-23T08:10:00.000Z"), createdAt: new Date("2026-08-23T08:06:00.000Z") },
    { id: 9004, category: "structure_context_alert", title: "إلغاء سياق مستوى الذهب", content: "تم إلغاء تنبيه السياق بعد تجاوز حد الإبطال المحدد عند إنشائه. يحتفظ السجل بالحدث لأغراض المراجعة فقط.", metadata: { symbol: "XAUUSD", exchange: "FX", interval: "4h", event: "invalidation", status: "cancelled" }, readAt: new Date("2026-08-23T06:32:00.000Z"), createdAt: new Date("2026-08-23T06:27:00.000Z") },
  ];
}

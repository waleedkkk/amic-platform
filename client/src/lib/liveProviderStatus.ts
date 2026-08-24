export type ChartLiveProviderStatus = "live" | "connecting" | "reconnecting" | "delayed" | "unavailable";

export function describeLiveProviderStatus(status: ChartLiveProviderStatus, provider: "binance" | "twelve-data") {
  const name = provider === "binance" ? "Binance" : "Twelve Data";
  switch (status) {
    case "live":
      return { label: provider === "binance" ? `● بث حي للشمعة · ${name}` : `● بث حي · ${name}`, className: "font-mono text-emerald-300" };
    case "connecting":
      return { label: `◌ جارٍ وصل ${name}`, className: "font-mono text-sky-300" };
    case "reconnecting":
      return { label: `◌ ${name} يعيد الاتصال`, className: "font-mono text-amber-300" };
    case "unavailable":
      return { label: `◌ ${name} غير متاح · استخدام الشموع التاريخية`, className: "font-mono text-rose-300" };
    default:
      return { label: `◌ ${name} متأخر وفق الإطار`, className: "font-mono text-amber-300" };
  }
}

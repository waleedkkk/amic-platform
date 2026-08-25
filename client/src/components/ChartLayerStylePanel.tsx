import { RotateCcw } from "lucide-react";
import type { ChartLayerColorKey, ChartLayerOpacityKey, ChartLayerStylePreferences } from "@shared/chartPreferences";

const colorControls: Array<{ key: ChartLayerColorKey; label: string }> = [
  { key: "sma20", label: "SMA 20" }, { key: "sma50", label: "SMA 50" }, { key: "ema12", label: "EMA 12" }, { key: "ema26", label: "EMA 26" },
  { key: "support", label: "الدعم" }, { key: "resistance", label: "المقاومة" }, { key: "demand", label: "منطقة الطلب" }, { key: "supply", label: "منطقة العرض" },
  { key: "ictTrend", label: "اتجاه ICT" }, { key: "ictBullish", label: "ICT صاعد" }, { key: "ictBearish", label: "ICT هابط" },
  { key: "buyLiquidity", label: "سيولة الشراء" }, { key: "sellLiquidity", label: "سيولة البيع" }, { key: "volumeUp", label: "حجم صاعد" }, { key: "volumeDown", label: "حجم هابط" },
];

const opacityControls: Array<{ key: ChartLayerOpacityKey; label: string }> = [
  { key: "trend", label: "خطوط الاتجاه والمتوسطات" }, { key: "levels", label: "المستويات والسيولة" }, { key: "zones", label: "مناطق العرض والطلب وICT" }, { key: "signals", label: "الإشارات والعلامات" }, { key: "volume", label: "أعمدة الحجم" },
];

export function ChartLayerStylePanel({ styles, onColorChange, onOpacityChange, onReset }: {
  styles: ChartLayerStylePreferences;
  onColorChange: (key: ChartLayerColorKey, color: string) => void;
  onOpacityChange: (key: ChartLayerOpacityKey, opacity: number) => void;
  onReset: () => void;
}) {
  return <section className="mb-3 rounded-xl border border-sky-400/20 bg-sky-400/[0.045] p-3 text-xs" aria-label="إعدادات ألوان وشفافية طبقات الشارت">
    <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold text-sky-100">مظهر طبقات الشارت</p><p className="mt-1 leading-5 text-muted-foreground">غيّر الألوان والشفافية، ثم تُحفظ تفضيلاتك للحساب الحالي.</p></div><button type="button" onClick={onReset} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-white/[0.12] px-2.5 text-xs text-muted-foreground transition-colors hover:border-sky-200/25 hover:bg-sky-400/[0.08] hover:text-sky-100"><RotateCcw className="size-3.5" /> استعادة الافتراضي</button></div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{colorControls.map(control => <label key={control.key} className="flex min-h-10 items-center justify-between gap-2 rounded-lg border border-white/[0.08] bg-black/15 px-2"><span className="text-muted-foreground">{control.label}</span><span className="flex items-center gap-1.5"><span className="font-mono text-[10px] text-slate-400">{styles.colors[control.key].toUpperCase()}</span><input type="color" value={styles.colors[control.key]} aria-label={`لون ${control.label}`} onChange={event => onColorChange(control.key, event.target.value)} className="size-6 cursor-pointer rounded border-0 bg-transparent p-0" /></span></label>)}</div>
    <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">{opacityControls.map(control => <label key={control.key} className="grid gap-1 rounded-lg border border-white/[0.08] bg-black/15 px-2 py-2"><span className="flex items-center justify-between gap-2 text-muted-foreground"><span>{control.label}</span><output className="font-mono text-[10px] text-sky-100">{Math.round(styles.opacity[control.key] * 100)}%</output></span><input type="range" min="0.15" max="1" step="0.05" value={styles.opacity[control.key]} aria-label={`شفافية ${control.label}`} onChange={event => onOpacityChange(control.key, Number(event.target.value))} className="accent-sky-400" /></label>)}</div>
  </section>;
}

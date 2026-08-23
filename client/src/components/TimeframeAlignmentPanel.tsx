import { Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { measureAtr, summarizeTimeframeAlignment } from "@shared/technicalMarketContext";
import { Activity, Gauge, Layers3 } from "lucide-react";
import { useMemo } from "react";

function directionView(direction: "bullish" | "bearish" | "neutral") {
  return direction === "bullish" ? { label: "صاعد", className: "text-emerald-300" } : direction === "bearish" ? { label: "هابط", className: "text-rose-300" } : { label: "محايد", className: "text-muted-foreground" };
}

export function TimeframeAlignmentPanel({ symbol, exchange, atr, price }: { symbol: string; exchange: string; atr: number | null; price: number | null }) {
  const query = trpc.market.multiTimeframe.useQuery({ symbol, exchange }, { refetchInterval: 90_000, refetchOnWindowFocus: true, retry: 1 });
  const summary = useMemo(() => summarizeTimeframeAlignment(query.data), [query.data]);
  const atrMeasure = useMemo(() => measureAtr(symbol, exchange, atr, price), [atr, exchange, price, symbol]);
  const dominant = directionView(summary.dominantDirection);

  return <Panel className="mt-6" aria-label="توافق الأطر وقياس التذبذب">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.13em] text-primary">TIMEFRAME ALIGNMENT</p><h2 className="mt-2 text-lg font-semibold">توافق الأطر والتذبذب</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">قراءة مقارنة للأطر المتاحة ومقياس تذبذب وصفي؛ ليست إشارة دخول مستقلة.</p></div>{query.isFetching ? <Activity className="size-5 animate-spin text-primary" /> : <Layers3 className="size-5 text-primary" />}</div>
    <div className="mt-5 grid gap-3 lg:grid-cols-[1.2fr_0.8fr]"><section className="rounded-xl border border-white/[0.08] bg-black/20 p-4"><div className="flex items-center justify-between gap-3"><div><p className="text-xs text-muted-foreground">الاتجاه الغالب</p><p className={`mt-1 text-lg font-semibold ${dominant.className}`}>{dominant.label}</p></div><div className="text-left"><p className="text-xs text-muted-foreground">اتفاق الأطر</p><p className="mt-1 font-mono text-lg">{summary.agreementPercent}%</p></div><div className="text-left"><p className="text-xs text-muted-foreground">الدرجة الصافية</p><p className="mt-1 font-mono text-lg">{summary.netScore ?? "—"}</p></div></div><p className="mt-3 text-xs text-muted-foreground">{summary.sourceStatus ?? "تُحسَب القراءة عند وصول تحليل الأطر."}{summary.confidence ? ` · ثقة المزود: ${summary.confidence}` : ""}</p></section>
      <section className="rounded-xl border border-cyan-400/15 bg-cyan-400/[0.04] p-4"><div className="flex items-center gap-2"><Gauge className="size-4 text-cyan-300" /><p className="text-sm font-medium">{atrMeasure.label}</p></div><p className="mt-3 font-mono text-xl">{atrMeasure.value === null ? "—" : atrMeasure.value.toLocaleString("en-US", { maximumFractionDigits: atrMeasure.digits })} {atrMeasure.unit ?? ""}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{atrMeasure.percentOfPrice === null ? "يتطلب ATR وسعرًا صالحين." : `${atrMeasure.percentOfPrice.toFixed(2)}% من السعر الحالي؛ مقياس للحركة المعتادة وليس وقف خسارة مقترحًا بذاته.`}</p></section></div>
    {query.isError ? <p className="mt-4 text-sm text-muted-foreground">تعذّر جلب توافق الأطر الآن، بينما يبقى مقياس ATR الحالي ظاهرًا من التحليل الأساسي.</p> : null}
    {query.isLoading ? <p className="mt-4 text-sm text-muted-foreground">جارٍ مقارنة الأطر الزمنية…</p> : null}
    {!query.isLoading && summary.frames.length ? <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-5">{summary.frames.map(frame => { const direction = directionView(frame.direction); const divergent = summary.divergentTimeframes.includes(frame.timeframe); return <article key={frame.timeframe} className={`rounded-xl border p-3 ${divergent ? "border-amber-400/25 bg-amber-400/[0.05]" : "border-white/[0.08] bg-white/[0.02]"}`}><div className="flex items-center justify-between"><p className="font-mono text-sm">{frame.label}</p><span className={`text-xs font-medium ${direction.className}`}>{direction.label}</span></div><p className="mt-3 text-xs text-muted-foreground">RSI {frame.rsi?.toFixed(1) ?? "—"} · score {frame.score ?? "—"}</p><p className="mt-1 text-xs text-muted-foreground">{frame.momentumAligned === true ? "الزخم متوافق" : frame.momentumAligned === false ? "الزخم غير متوافق" : "الزخم غير محدد"}</p></article>; })}</div> : null}
  </Panel>;
}

import { Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { calculateSessionHeatmap, TRADING_SESSION_LABELS } from "@shared/sessionHeatmap";
import { useMemo } from "react";

function heatClass(rate: number) {
  if (rate >= 0.14) return "border-rose-400/30 bg-rose-400/[0.18] text-rose-100";
  if (rate >= 0.08) return "border-amber-400/30 bg-amber-400/[0.15] text-amber-100";
  if (rate > 0) return "border-sky-400/20 bg-sky-400/[0.10] text-sky-100";
  return "border-white/[0.08] bg-white/[0.02] text-muted-foreground";
}

export function SessionHeatmapPanel({ symbol, exchange }: { symbol: string; exchange: string }) {
  const candlesQuery = trpc.market.candles.useQuery({ symbol, exchange, interval: "60m", range: "3mo", limit: 600 }, { staleTime: 5 * 60_000, retry: 1 });
  const heatmap = useMemo(() => calculateSessionHeatmap(candlesQuery.data?.candles ?? []), [candlesQuery.data?.candles]);
  return <Panel className="mt-6"><p className="text-xs font-semibold tracking-[0.13em] text-primary">SESSION HEATMAP</p><h2 className="mt-2 text-lg font-semibold">متى تظهر أحداث بنية السعر تاريخيًا؟</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">معدل BOS والكسر والانعكاس وفق جلسة الشمعة بتوقيت UTC، على بيانات ساعة تاريخية متاحة. ليس توقعًا لحركة مستقبلية.</p>{candlesQuery.isLoading ? <p className="mt-5 text-sm text-muted-foreground">جارٍ تحليل الجلسات…</p> : candlesQuery.isError ? <p className="mt-5 text-sm text-destructive">تعذّر جلب تاريخ كافٍ لخريطة الجلسات.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-3">{heatmap.map(cell => <article key={cell.session} className={`rounded-xl border p-4 ${heatClass(cell.eventRate)}`}><div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{TRADING_SESSION_LABELS[cell.session]}</h3><span className="font-mono text-sm">{(cell.eventRate * 100).toFixed(1)}%</span></div><dl className="mt-4 grid grid-cols-3 gap-2 text-center text-xs"><div><dt className="text-current/70">أحداث</dt><dd className="mt-1 font-mono text-base">{cell.events}</dd></div><div><dt className="text-current/70">كسر</dt><dd className="mt-1 font-mono text-base">{cell.breakouts}</dd></div><div><dt className="text-current/70">انعكاس</dt><dd className="mt-1 font-mono text-base">{cell.reversals}</dd></div></dl><p className="mt-3 text-[11px] text-current/70">{cell.candles} شمعة في العينة</p></article>)}</div>}</Panel>;
}

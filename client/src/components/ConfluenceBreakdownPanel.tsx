import { Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { calculateConfluenceIct } from "@shared/confluenceIct";
import { useMemo } from "react";

type BreakdownInterval = "15m" | "60m" | "4h" | "1d" | "1wk";

function rangeFor(interval: BreakdownInterval): "5d" | "1mo" | "3mo" | "6mo" | "2y" {
  if (interval === "15m") return "5d";
  if (interval === "60m") return "1mo";
  if (interval === "4h") return "3mo";
  if (interval === "1d") return "6mo";
  return "2y";
}

function directionLabel(direction: "bullish" | "bearish") {
  return direction === "bullish" ? "صاعد" : "هابط";
}

export function ConfluenceBreakdownPanel({ symbol, exchange, interval = "60m", enabled = true }: { symbol: string; exchange: string; interval?: BreakdownInterval; enabled?: boolean }) {
  const candlesQuery = trpc.market.candles.useQuery({ symbol, exchange, interval, range: rangeFor(interval), limit: 240 }, { enabled, staleTime: 60_000, retry: 1, refetchOnWindowFocus: false });
  const result = useMemo(() => calculateConfluenceIct(candlesQuery.data?.candles ?? []), [candlesQuery.data?.candles]);
  const signal = result.signals.at(-1);

  return (
    <Panel className="mt-6" aria-label="تفكيك درجة التلاقي">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div><p className="text-xs font-semibold tracking-[0.13em] text-primary">WHY THIS SIGNAL?</p><h2 className="mt-2 text-lg font-semibold">تفكيك درجة التلاقي</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">تفسير للنتائج المحسوبة بالفعل على شموع {interval === "60m" ? "1h" : interval}، وليس نموذج توصية جديدًا.</p></div>
        <span className="rounded-lg border border-white/[0.1] bg-black/20 px-3 py-2 font-mono text-xs">{signal ? `${signal.label} ${signal.score}/${signal.maxScore}` : `${result.summary.signal} ${Math.max(result.summary.confluence.bull, result.summary.confluence.bear)}/${result.summary.confluence.max}`}</span>
      </div>
      {candlesQuery.isLoading ? <p className="mt-5 text-sm text-muted-foreground">جارٍ تجهيز تفكيك العوامل…</p> : null}
      {candlesQuery.isError ? <p className="mt-5 text-sm text-destructive">تعذّر تجهيز تفكيك العوامل لهذه القراءة.</p> : null}
      {!candlesQuery.isLoading && !candlesQuery.isError ? <>
        <div className="mt-5 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {result.breakdown.length ? result.breakdown.map(item => <article key={item.id} className={`rounded-xl border p-3 ${item.direction === "bullish" ? "border-emerald-400/20 bg-emerald-400/[0.05]" : "border-rose-400/20 bg-rose-400/[0.05]"}`}><div className="flex items-center justify-between gap-2"><h3 className="text-sm font-medium">{item.label}</h3><span className={`font-mono text-xs ${item.direction === "bullish" ? "text-emerald-300" : "text-rose-300"}`}>{directionLabel(item.direction)} · {item.points}/{item.maxPoints}</span></div><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.description}</p></article>) : <p className="text-sm text-muted-foreground">لا توجد عوامل نشطة كافية لتفكيكها في آخر شمعة.</p>}
        </div>
        {(result.zones.length || result.events.length) ? <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/20 p-3"><p className="text-xs font-semibold text-foreground">السياق المرئي الداعم</p><div className="mt-3 flex flex-wrap gap-2 text-xs">{result.zones.slice(-3).map(zone => <span key={zone.id} className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1">{zone.label}{zone.score ? ` · قوة ${zone.score}/5` : ""}</span>)}{result.events.slice(-3).map(event => <span key={event.id} title={event.explanation} className="rounded-md border border-white/[0.1] bg-white/[0.03] px-2 py-1">{event.label}</span>)}</div></div> : null}
      </> : null}
    </Panel>
  );
}

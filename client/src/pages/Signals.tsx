import { Button } from "@/components/ui/button";
import { EmptyAction, formatValue, PageHeading, Panel, SignalBadge } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { ArrowDownRight, ArrowUpRight, BookmarkCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

type StoredCrossover = {
  kind: "golden" | "death";
  crossedAt: number;
  price: number;
  fastPeriod: number;
  slowPeriod: number;
  barsSince: number;
  interval?: string;
};

function readCrossover(payload: unknown): StoredCrossover | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return null;
  const candidate = (payload as Record<string, unknown>).movingAverageCrossover;
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  const event = candidate as Record<string, unknown>;
  if ((event.kind !== "golden" && event.kind !== "death") || typeof event.crossedAt !== "number" || typeof event.price !== "number") return null;
  return {
    kind: event.kind,
    crossedAt: event.crossedAt,
    price: event.price,
    fastPeriod: typeof event.fastPeriod === "number" ? event.fastPeriod : 20,
    slowPeriod: typeof event.slowPeriod === "number" ? event.slowPeriod : 50,
    barsSince: typeof event.barsSince === "number" ? event.barsSince : 0,
    interval: typeof event.interval === "string" ? event.interval : undefined,
  };
}

export default function Signals() {
  const utils = trpc.useUtils();
  const signals = trpc.signals.list.useQuery();
  const remove = trpc.signals.delete.useMutation({ onSuccess: () => { toast.success("حُذفت الإشارة من سجلك."); utils.signals.list.invalidate(); }, onError: error => toast.error(error.message) });
  return <><PageHeading eyebrow="PERSONAL SIGNAL LOG" title="الإشارات المحفوظة" description="سجل خاص لقراءاتك الفنية. عند حفظ التحليل، يُرصد تقاطع SMA 20/50 تلقائيًا ويُعرض هنا لتسهيل مراجعة القرار." /><Panel>{signals.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل الإشارات…</p> : signals.data?.length ? <div className="divide-y divide-white/[0.06]">{signals.data.map(signal => {
    const crossover = readCrossover(signal.analysisPayload);
    const golden = crossover?.kind === "golden";
    return <div className="flex flex-col gap-4 py-5 first:pt-0 sm:flex-row sm:items-center sm:justify-between" key={signal.id}><div className="flex items-start gap-3"><div className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary"><BookmarkCheck className="size-4" /></div><div><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-medium">{signal.symbol}</p><span className="text-xs text-muted-foreground">{signal.exchange} · {signal.timeframe}</span><SignalBadge value={signal.recommendation} /></div><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{signal.summary}</p>{crossover ? <div className={`mt-3 flex max-w-2xl flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border px-3 py-2 text-xs ${golden ? "border-emerald-400/25 bg-emerald-400/[0.07] text-emerald-200" : "border-rose-400/25 bg-rose-400/[0.07] text-rose-200"}`}><span className="flex items-center gap-1 font-semibold">{golden ? <ArrowUpRight className="size-4" /> : <ArrowDownRight className="size-4" />}{golden ? "التقاطع الذهبي" : "تقاطع الموت"}</span><span className="opacity-85">SMA {crossover.fastPeriod} / SMA {crossover.slowPeriod} · سعر التقاطع: {formatValue(crossover.price, 6)}</span><span className="opacity-75">{new Date(crossover.crossedAt * 1000).toLocaleString("ar")} · قبل {crossover.barsSince} شموع{crossover.interval ? ` (${crossover.interval})` : ""}</span></div> : null}<p className="mt-2 text-[11px] text-muted-foreground">الثقة: {formatValue(signal.confidence, 0)} · حُفظت {new Date(signal.createdAt).toLocaleString("ar")}</p></div></div><Button size="sm" variant="ghost" className="text-rose-300 hover:bg-rose-400/10 hover:text-rose-200" disabled={remove.isPending} onClick={() => remove.mutate({ id: signal.id })}><Trash2 className="ml-1 size-4" />حذف</Button></div>;
  })}</div> : <EmptyAction title="سجل الإشارات فارغ" description="يمكنك حفظ قراءة أي أصل من صفحة التحليل الفني لتظهر هنا مع إطارها الزمني وملخصها." href="/analysis" action="افتح التحليل الفني" />}</Panel></>;
}

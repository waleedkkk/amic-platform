import { Button } from "@/components/ui/button";
import { EmptyAction, formatValue, PageHeading, Panel, SignalBadge } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { BookmarkCheck, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Signals() {
  const utils = trpc.useUtils();
  const signals = trpc.signals.list.useQuery();
  const remove = trpc.signals.delete.useMutation({ onSuccess: () => { toast.success("حُذفت الإشارة من سجلك."); utils.signals.list.invalidate(); }, onError: error => toast.error(error.message) });
  return <><PageHeading eyebrow="PERSONAL SIGNAL LOG" title="الإشارات المحفوظة" description="سجل خاص لقراءاتك الفنية، يساعدك في متابعة الفرضيات ومراجعة أثرها بعد إغلاق صفقاتك الورقية." /><Panel>{signals.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل الإشارات…</p> : signals.data?.length ? <div className="divide-y divide-white/[0.06]">{signals.data.map(signal => <div className="flex flex-col gap-4 py-5 first:pt-0 sm:flex-row sm:items-center sm:justify-between" key={signal.id}><div className="flex items-start gap-3"><div className="mt-0.5 flex size-9 items-center justify-center rounded-xl bg-primary/12 text-primary"><BookmarkCheck className="size-4" /></div><div><div className="flex flex-wrap items-center gap-2"><p className="font-mono text-sm font-medium">{signal.symbol}</p><span className="text-xs text-muted-foreground">{signal.exchange} · {signal.timeframe}</span><SignalBadge value={signal.recommendation} /></div><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{signal.summary}</p><p className="mt-2 text-[11px] text-muted-foreground">الثقة: {formatValue(signal.confidence, 0)} · حُفظت {new Date(signal.createdAt).toLocaleString("ar")}</p></div></div><Button size="sm" variant="ghost" className="text-rose-300 hover:bg-rose-400/10 hover:text-rose-200" disabled={remove.isPending} onClick={() => remove.mutate({ id: signal.id })}><Trash2 className="ml-1 size-4" />حذف</Button></div>)}</div> : <EmptyAction title="سجل الإشارات فارغ" description="يمكنك حفظ قراءة أي أصل من صفحة التحليل الفني لتظهر هنا مع إطارها الزمني وملخصها." href="/analysis" action="افتح التحليل الفني" />}</Panel></>;
}

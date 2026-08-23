import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { EmptyAction, PageHeading, Panel } from "@/components/market-ui";
import { getLocalAlertCenterDemoItems, type AlertCenterDemoItem } from "@/lib/alertCenterDemo";
import { trpc } from "@/lib/trpc";
import { BellRing, CheckCheck, ExternalLink, Filter, ShieldAlert } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";

type Category = "all" | "metal_alert" | "structure_alert" | "structure_context_alert";

const labels: Record<Category, string> = { all: "كل التنبيهات", metal_alert: "المعادن", structure_alert: "البنية", structure_context_alert: "السياق" };

function categoryClass(category: Exclude<Category, "all">) { return category === "metal_alert" ? "bg-amber-400/10 text-amber-200" : category === "structure_context_alert" ? "bg-primary/10 text-primary" : "bg-sky-400/10 text-sky-200"; }
function metadataValue(metadata: unknown, key: string) { return metadata && typeof metadata === "object" && key in metadata ? (metadata as Record<string, unknown>)[key] : null; }

export default function AlertCenter() { return <AlertCenterView />; }
export function LocalAlertCenterPreview() { return <AlertCenterView demoMode />; }

function AlertCenterView({ demoMode = false }: { demoMode?: boolean }) {
  const [category, setCategory] = useState<Category>("all");
  const [symbol, setSymbol] = useState("");
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [demoItems, setDemoItems] = useState<AlertCenterDemoItem[]>(() => getLocalAlertCenterDemoItems());
  const utils = trpc.useUtils();
  const query = trpc.alertCenter.list.useQuery({ category, symbol: symbol.trim() || undefined, unreadOnly }, { enabled: !demoMode, staleTime: 20_000, refetchOnWindowFocus: true });
  const markRead = trpc.alertCenter.markRead.useMutation({ onSuccess: () => void utils.alertCenter.list.invalidate() });
  const items = useMemo(() => {
    const source = (demoMode ? demoItems : query.data ?? []) as AlertCenterDemoItem[];
    return source.filter(item => (category === "all" || item.category === category) && (!symbol.trim() || metadataValue(item.metadata, "symbol") === symbol.trim().toUpperCase()) && (!unreadOnly || !item.readAt));
  }, [category, demoItems, demoMode, query.data, symbol, unreadOnly]);
  const summary = useMemo(() => ({ total: items.length, unread: items.filter(item => !item.readAt).length }), [items]);
  const markCurrentItemRead = (id: number) => {
    if (demoMode) { setDemoItems(current => current.map(item => item.id === id ? { ...item, readAt: new Date() } : item)); return; }
    markRead.mutate({ id });
  };

  return <><PageHeading eyebrow={demoMode ? "LOCAL DEMO — ALERT REVIEW CENTER" : "ALERT REVIEW CENTER"} title="مركز متابعة التنبيهات" description={demoMode ? "هذه معاينة محلية ببيانات افتراضية داخل المتصفح؛ لا تتصل بالسوق أو الخادم ولا تغير بيانات أي حساب." : "سجل خاص بحسابك لنتائج تنبيهات المعادن والبنية والسياق. يصف ما حدث ولا يمثل توصية تداول أو توقعًا."} />
    <div className="mb-6 grid gap-3 sm:grid-cols-2"><Panel className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><BellRing className="size-3.5 text-primary" />نتائج مطابقة للفلاتر</div><p className="mt-2 font-mono text-xl">{summary.total}</p></Panel><Panel className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><CheckCheck className="size-3.5 text-emerald-300" />غير المقروءة</div><p className="mt-2 font-mono text-xl">{summary.unread}</p></Panel></div>
    <Panel><div className="flex flex-wrap items-end gap-3"><div className="min-w-44"><p className="mb-2 text-xs text-muted-foreground">نوع التنبيه</p><Select value={category} onValueChange={value => setCategory(value as Category)}><SelectTrigger className="bg-white/[0.025]"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(labels).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}</SelectContent></Select></div><div className="min-w-48 flex-1"><p className="mb-2 text-xs text-muted-foreground">الرمز</p><Input value={symbol} onChange={event => setSymbol(event.target.value.toUpperCase())} placeholder="مثال: XAUUSD" className="bg-white/[0.025] font-mono" /></div><Button type="button" variant={unreadOnly ? "default" : "outline"} className="bg-white/[0.03]" onClick={() => setUnreadOnly(value => !value)}><Filter className="ml-1.5 size-4" />غير المقروءة فقط</Button></div>
      <div className="mt-6 space-y-3">{!demoMode && query.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل سجل التنبيهات…</p> : !demoMode && query.isError ? <p className="rounded-xl border border-rose-400/25 bg-rose-400/[0.06] p-4 text-sm text-rose-100">تعذر تحميل السجل الآن. حاول التحديث لاحقًا.</p> : items.length ? items.map(item => { const itemSymbol = metadataValue(item.metadata, "symbol"); const exchange = metadataValue(item.metadata, "exchange"); const interval = metadataValue(item.metadata, "interval"); return <article key={item.id} className={`rounded-xl border p-4 ${item.readAt ? "border-white/[0.08] bg-white/[0.015]" : "border-primary/25 bg-primary/[0.04]"}`}><div className="flex flex-wrap items-start justify-between gap-3"><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-1 text-[11px] ${categoryClass(item.category)}`}>{labels[item.category]}</span>{!item.readAt ? <span className="rounded bg-primary/10 px-2 py-1 text-[11px] text-primary">جديد</span> : null}</div><h2 className="mt-3 font-semibold">{item.title}</h2><p className="mt-1 text-sm leading-6 text-muted-foreground">{item.content}</p><p className="mt-3 text-xs text-muted-foreground">{new Date(item.createdAt).toLocaleString("ar-EG")}</p></div><div className="flex shrink-0 gap-2">{typeof itemSymbol === "string" && !demoMode ? <Link href={`/analysis?symbol=${encodeURIComponent(itemSymbol)}&exchange=${encodeURIComponent(typeof exchange === "string" ? exchange : "FX")}&timeframe=${encodeURIComponent(typeof interval === "string" ? interval : "1h")}`}><Button size="sm" variant="outline" className="bg-white/[0.03]"><ExternalLink className="ml-1.5 size-3.5" />راجع</Button></Link> : typeof itemSymbol === "string" ? <Button size="sm" variant="outline" disabled className="bg-white/[0.03]"><ExternalLink className="ml-1.5 size-3.5" />مراجعة محاكاة</Button> : null}{!item.readAt ? <Button size="sm" variant="ghost" onClick={() => markCurrentItemRead(item.id)} disabled={!demoMode && markRead.isPending}><CheckCheck className="ml-1.5 size-3.5" />قُرئ</Button> : null}</div></div></article>; }) : <EmptyAction title="لا توجد نتائج مطابقة" description={demoMode ? "غيّر الفلاتر لإظهار بيانات المعاينة المحلية." : "عند تحقق أحد التنبيهات الاختيارية سيظهر هنا مصدره وسعره ووقته ضمن حسابك فقط."} href="/analysis" action="افتح التحليل" />}</div>
      <div className="mt-5 flex gap-2 rounded-xl border border-amber-400/15 bg-amber-400/[0.04] p-3 text-xs leading-5 text-muted-foreground"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-300" /><p>السجل يوثق أحداثًا سعرية وفق إعداداتك. لا يحكم على نجاح التنبيه ولا يثبت علاقة سببية أو يوصي بفتح أو إغلاق صفقة.</p></div>
    </Panel>
  </>;
}

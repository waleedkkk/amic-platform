import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { MetricCard, Panel, formatValue } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { getCacheChartData, getServiceChartData } from "@shared/adminOperationsCharts";
import { Activity, Bot, DatabaseZap, RefreshCw, ShieldCheck, Trash2, UsersRound, WalletCards } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, Cell, Label, Pie, PieChart, XAxis, YAxis } from "recharts";

const cacheChartConfig = {
  fresh: { label: "صالحة حاليًا", color: "#34d399" },
  retained: { label: "ضمن نافذة الاحتفاظ", color: "#fbbf24" },
  cleanup: { label: "مؤهلة للتنظيف", color: "#fb7185" },
} satisfies ChartConfig;

const serviceChartConfig = {
  value: { label: "مهيأة", color: "#38bdf8" },
} satisfies ChartConfig;

export type AdminOperationsView = "overview" | "maintenance";

const dashboardCopy: Record<AdminOperationsView, { title: string; description: string }> = {
  overview: {
    title: "نظرة تشغيلية",
    description: "ملخص آني محدود يساعدك في متابعة الاستخدام والتهيئة، دون عرض أسرار أو سجلات المستخدمين الخاصة.",
  },
  maintenance: {
    title: "صيانة السوق والكاش",
    description: "متابعة لقطات كاش السوق وإجراءات التنظيف المحدودة، من دون التأثير في الصفقات أو الإشارات أو الحسابات.",
  },
};

export function AdminOperationsDashboard({ view = "overview" }: { view?: AdminOperationsView }) {
  const utils = trpc.useUtils();
  const overview = trpc.auth.admin.dashboard.overview.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: true });
  const marketPerformance = trpc.auth.admin.dashboard.marketPerformance.useQuery(undefined, { enabled: view === "maintenance", refetchInterval: 60_000, refetchOnWindowFocus: true });
  const cleanup = trpc.auth.admin.dashboard.cleanupExpiredSnapshots.useMutation({
    onSuccess: result => {
      setStatus(result.deleted > 0 ? `أُزيلت ${formatValue(result.deleted, 0)} لقطة منتهية بأمان.` : "لا توجد لقطات مؤهلة للتنظيف الآن.");
      void utils.auth.admin.dashboard.overview.invalidate();
    },
    onError: error => setStatus(error.message),
  });
  const [status, setStatus] = useState<string | null>(null);
  const data = overview.data;
  const checkedAt = data?.checkedAt ? new Date(data.checkedAt).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" }) : null;
  const cacheChartData = data ? getCacheChartData(data.marketCache) : [];
  const cacheTotal = cacheChartData.reduce((sum, item) => sum + item.value, 0);
  const serviceChartData = data ? getServiceChartData(data) : [];
  const copy = dashboardCopy[view];

  const refresh = () => {
    setStatus(null);
    void overview.refetch();
  };

  return (
    <section className="space-y-4" aria-label={copy.title}>
      <div className="flex flex-col gap-3 min-[500px]:flex-row min-[500px]:items-end min-[500px]:justify-between">
        <div>
          <div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><h2 className="text-lg font-semibold">{copy.title}</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="min-h-11 border-border/70 bg-card/70" onClick={refresh} disabled={overview.isFetching}>
          <RefreshCw className={`ml-1.5 size-4 ${overview.isFetching ? "animate-spin" : ""}`} />تحديث الحالة
        </Button>
      </div>

      {overview.isLoading ? <Panel className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"><RefreshCw className="ml-2 size-4 animate-spin" />جارٍ تحميل مؤشرات العمليات…</Panel> : overview.error ? <Panel className="border-rose-400/25 bg-rose-400/[0.05]"><p className="text-sm text-rose-200">تعذر تحميل الملخص التشغيلي: {overview.error.message}</p></Panel> : data ? view === "overview" ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="إجمالي المستخدمين" value={formatValue(data.users.total, 0)} detail={`${formatValue(data.users.activeLast7Days, 0)} نشطون خلال 7 أيام`} icon={<UsersRound className="size-4 text-sky-300" />} />
          <MetricCard label="الحسابات الإدارية" value={formatValue(data.users.admins, 0)} detail="صلاحيات التحكم محصورة بالحسابات الإدارية" icon={<ShieldCheck className="size-4 text-emerald-300" />} positive />
          <MetricCard label="المراكز الورقية المفتوحة" value={formatValue(data.paperTrading.openTrades, 0)} detail="متابعة تشغيلية، وليست تنفيذًا فعليًا" icon={<WalletCards className="size-4 text-violet-300" />} />
          <MetricCard label="لقطات الكاش" value={formatValue(data.marketCache.cachedSnapshots, 0)} detail={`${formatValue(data.marketCache.cleanupEligibleSnapshots, 0)} مؤهلة للتنظيف`} icon={<DatabaseZap className="size-4 text-amber-200" />} />
        </div>

        <Panel className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">مؤشرات تهيئة الخدمات</p><p className="mt-1 text-xs leading-5 text-muted-foreground">يعرض الرسم حالة التهيئة والبيانات المحلية فقط، وليس اختبار اتصال خارجيًا أو قياس وقت تشغيل.</p></div><Badge variant="outline" className="border-border/70 bg-card/70">آخر تحديث: {checkedAt ?? "—"}</Badge></div>
          <ChartContainer id="admin-service-readiness" config={serviceChartConfig} className="mt-3 h-44 w-full"><BarChart accessibilityLayer data={serviceChartData} layout="vertical" margin={{ right: 8, left: 12 }}><XAxis type="number" domain={[0, 1]} hide /><YAxis type="category" dataKey="name" width={92} tickLine={false} axisLine={false} className="text-[11px]" /><ChartTooltip cursor={{ fill: "rgba(255,255,255,0.04)" }} content={<ChartTooltipContent hideLabel formatter={(_value, _name, item) => <div className="flex w-full items-center justify-between gap-3"><span className="text-muted-foreground">الحالة</span><span className="font-medium text-foreground">{item.payload.status}</span></div>} />} /><Bar dataKey="value" radius={6} fill="var(--color-value)" barSize={18} /></BarChart></ChartContainer>
          <ul className="mt-1 grid gap-1.5 sm:grid-cols-3" aria-label="تفصيل حالة الخدمات">{serviceChartData.map(item => <li key={item.key} className="flex items-center gap-1.5 text-[11px] text-muted-foreground"><span className={`size-2 rounded-full ${item.value ? "bg-emerald-400" : "bg-rose-400"}`} />{item.name}: <span className="text-foreground">{item.status}</span></li>)}</ul>
        </Panel>
      </> : <>
        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel className="p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">توزيع كاش السوق</p><p className="mt-1 text-xs leading-5 text-muted-foreground">لقطات صالحة، ولقطات ضمن الاحتفاظ التشخيصي، ولقطات مؤهلة للتنظيف. لا يعرض الرسم سجلًا تاريخيًا غير محفوظ.</p></div><Badge variant="outline" className="border-border/70 bg-card/70">{formatValue(cacheTotal, 0)} لقطة</Badge></div>
            {cacheTotal > 0 ? <div className="mt-3 grid items-center gap-2 min-[520px]:grid-cols-[11rem_1fr]" dir="rtl">
              <ChartContainer id="admin-cache-distribution" config={cacheChartConfig} className="mx-auto aspect-square h-44 w-44"><PieChart><ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel nameKey="name" />} /><Pie data={cacheChartData} dataKey="value" nameKey="name" innerRadius={48} outerRadius={72} strokeWidth={3}>{cacheChartData.map(item => <Cell key={item.key} fill={item.fill} />)}<Label position="center" content={({ viewBox }) => viewBox && "cx" in viewBox && "cy" in viewBox ? <text x={viewBox.cx} y={viewBox.cy} textAnchor="middle" dominantBaseline="middle"><tspan className="fill-foreground text-xl font-semibold">{formatValue(cacheTotal, 0)}</tspan><tspan x={viewBox.cx} dy="1.45em" className="fill-muted-foreground text-[10px]">إجمالي اللقطات</tspan></text> : null} /></Pie></PieChart></ChartContainer>
              <ul className="grid gap-2" aria-label="تفصيل كاش السوق">{cacheChartData.map(item => <li key={item.key} className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs"><span className="flex items-center gap-2"><span className="size-2.5 rounded-full" style={{ backgroundColor: item.fill }} />{item.name}</span><strong className="tabular-nums text-foreground">{formatValue(item.value, 0)}</strong></li>)}</ul>
            </div> : <div className="mt-4 flex min-h-40 items-center justify-center rounded-xl border border-dashed border-border/70 text-center text-sm text-muted-foreground">لا توجد لقطات كاش محفوظة بعد. سيظهر التوزيع عند جلب بيانات السوق.</div>}
          </Panel>

          <Panel className="p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">ضوابط الخدمات</p><p className="mt-1 text-xs leading-5 text-muted-foreground">حالات التهيئة التي يمكن مراجعتها من دون كشف المفاتيح أو بيانات الحسابات.</p></div><Badge variant="outline" className="border-border/70 bg-card/70">آخر تحديث: {checkedAt ?? "—"}</Badge></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-muted/25 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Bot className="size-3.5 text-primary" />المساعد الذكي</div><p className="mt-2 text-sm font-medium text-foreground">{data.ai.activeProvider ? `${data.ai.activeProvider.provider} · ${data.ai.activeProvider.model}` : "لا يوجد مزود نشط"}</p><p className="mt-1 text-[11px] text-muted-foreground">{formatValue(data.ai.configuredProviders, 0)} مزود/مزودات بمفتاح محفوظ</p></div>
              <div className="rounded-xl border border-border/60 bg-muted/25 p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DatabaseZap className="size-3.5 text-primary" />تنظيف اللقطات</div><p className="mt-2 text-sm font-medium text-foreground">{data.cleanup.registered ? "مهمة مجدولة مسجلة" : "لا توجد مهمة مسجلة"}</p><p className="mt-1 text-[11px] text-muted-foreground">التنظيف التلقائي يحذف الكاش المنتهي منذ أكثر من يوم فقط.</p></div>
            </div>
          </Panel>
        </div>

        <Panel className="p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">أداء كاش الشموع</p><p className="mt-1 text-xs leading-5 text-muted-foreground">قياس مجمع للمثيل الحالي فقط: لا يحفظ الرموز أو المستخدمين أو محتوى الطلبات. يُعاد ضبطه عند إعادة تشغيل الخدمة.</p></div><Badge variant="outline" className="border-border/70 bg-card/70">{marketPerformance.data ? "قياس محلي" : "بانتظار بيانات"}</Badge></div>
          {marketPerformance.isLoading ? <div className="mt-4 text-sm text-muted-foreground">جارٍ تحميل المقاييس…</div> : marketPerformance.error ? <div className="mt-4 text-sm text-rose-200">تعذر تحميل مقاييس الكاش: {marketPerformance.error.message}</div> : marketPerformance.data ? <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label="طلبات الشموع" value={formatValue(marketPerformance.data.candles.requests, 0)} detail={`${formatValue(marketPerformance.data.candles.failedRequests, 0)} فشل`} icon={<Activity className="size-4 text-sky-300" />} />
            <MetricCard label="إصابات الكاش" value={formatValue(marketPerformance.data.candles.cacheHits, 0)} detail={marketPerformance.data.candles.cacheHitRate === null ? "لا توجد طلبات ناجحة بعد" : `${marketPerformance.data.candles.cacheHitRate}% من الطلبات الناجحة`} icon={<DatabaseZap className="size-4 text-emerald-300" />} positive />
            <MetricCard label="متوسط الاستجابة" value={marketPerformance.data.candles.averageLatencyMs === null ? "—" : `${formatValue(marketPerformance.data.candles.averageLatencyMs, 0)} ms`} detail={`${formatValue(marketPerformance.data.candles.latencySamples, 0)} عينة ضمن المثيل`} icon={<Activity className="size-4 text-violet-300" />} />
            <MetricCard label="P95 للاستجابة" value={marketPerformance.data.candles.p95LatencyMs === null ? "—" : `${formatValue(marketPerformance.data.candles.p95LatencyMs, 0)} ms`} detail={`${formatValue(marketPerformance.data.candles.freshFetches, 0)} جلب جديد من المصدر`} icon={<DatabaseZap className="size-4 text-amber-200" />} />
          </div> : null}
        </Panel>

        <Panel className="border-amber-300/15 bg-gradient-to-br from-amber-300/[0.07] to-transparent p-4">
          <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200"><Trash2 className="size-4" /></span><div className="min-w-0"><p className="text-sm font-semibold">تنظيف كاش السوق المنتهي</p><p className="mt-1 text-xs leading-5 text-muted-foreground">إجراء يدوي محدود يحذف لقطات الكاش المنتهية منذ أكثر من 24 ساعة فقط. لا يمس الصفقات أو الإشارات أو حسابات المستخدمين.</p></div></div>
          <AlertDialog><AlertDialogTrigger asChild><Button type="button" size="sm" variant="outline" className="mt-4 min-h-11 border-amber-300/30 text-amber-100 hover:bg-amber-300/10" disabled={cleanup.isPending}><Trash2 className="ml-1.5 size-4" />{cleanup.isPending ? "جارٍ التنظيف…" : "تنظيف اللقطات المنتهية"}</Button></AlertDialogTrigger><AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>تأكيد تنظيف كاش السوق</AlertDialogTitle><AlertDialogDescription>سيُحذف فقط كاش السوق المنتهي منذ أكثر من 24 ساعة. لن تتأثر الصفقات الورقية أو الإشارات أو بيانات المستخدمين.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => cleanup.mutate()}>تنفيذ تنظيف آمن</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
        </Panel>
      </> : null}
      {status ? <p role="status" className={`text-xs ${status.startsWith("أُزيلت") || status.startsWith("لا توجد") ? "text-emerald-300" : "text-destructive"}`}>{status}</p> : null}
    </section>
  );
}

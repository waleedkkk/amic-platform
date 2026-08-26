import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { MetricCard, Panel, formatValue } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { Activity, Bot, RefreshCw, ShieldCheck, Sigma } from "lucide-react";
import { useState } from "react";
import { Bar, BarChart, XAxis, YAxis } from "recharts";

const usageChartConfig = { totalTokens: { label: "الرموز المبلّغ عنها", color: "#818cf8" } } satisfies ChartConfig;

export function AdminAiUsageMonitor() {
  const [periodDays, setPeriodDays] = useState<7 | 30>(7);
  const usage = trpc.auth.admin.ai.usage.useQuery({ periodDays }, { refetchInterval: 60_000, refetchOnWindowFocus: true });
  const data = usage.data;

  return <section className="space-y-4" aria-label="مراقبة استهلاك النماذج">
    <div className="flex flex-col gap-3 min-[460px]:flex-row min-[460px]:items-end min-[460px]:justify-between">
      <div><div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><h2 className="text-lg font-semibold">مراقبة استهلاك النماذج</h2></div><p className="mt-1 text-sm text-muted-foreground">تُعرض الطلبات والرموز التي يبلغ عنها المزود فقط. لا تُسجّل نصوص المحادثات أو المفاتيح أو هوية المستخدم.</p></div>
      <div className="flex gap-2"><Select value={String(periodDays)} onValueChange={value => setPeriodDays(value === "30" ? 30 : 7)}><SelectTrigger aria-label="فترة مراقبة استخدام النماذج" className="min-h-11 w-36 border-border/70 bg-card/70"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="7">آخر 7 أيام</SelectItem><SelectItem value="30">آخر 30 يومًا</SelectItem></SelectContent></Select><Button type="button" size="sm" variant="outline" className="min-h-11 border-border/70 bg-card/70" onClick={() => void usage.refetch()} disabled={usage.isFetching}><RefreshCw className={`size-4 ${usage.isFetching ? "animate-spin" : ""}`} /><span className="sr-only">تحديث الاستهلاك</span></Button></div>
    </div>

    {usage.isLoading ? <Panel className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"><RefreshCw className="ml-2 size-4 animate-spin" />جارٍ تحميل بيانات الاستهلاك…</Panel> : usage.error ? <Panel className="border-rose-400/25 bg-rose-400/[0.05]"><p className="text-sm text-rose-200">تعذر تحميل استهلاك النماذج: {usage.error.message}</p></Panel> : data ? <>
      <div className="grid gap-3 sm:grid-cols-3">
        <MetricCard label="إجمالي الطلبات" value={formatValue(data.requests, 0)} detail={`خلال آخر ${data.periodDays} أيام`} icon={<Bot className="size-4 text-sky-300" />} />
        <MetricCard label="طلبات أبلغت عن الرموز" value={formatValue(data.reportedUsageRequests, 0)} detail={`${formatValue(Math.max(0, data.requests - data.reportedUsageRequests), 0)} طلب بلا بيانات رموز من المزود`} icon={<ShieldCheck className="size-4 text-emerald-300" />} />
        <MetricCard label="إجمالي الرموز المبلّغ عنها" value={formatValue(data.totalTokens, 0)} detail={`مدخلات ${formatValue(data.inputTokens, 0)} · مخرجات ${formatValue(data.outputTokens, 0)}`} icon={<Sigma className="size-4 text-violet-300" />} />
      </div>
      {data.models.length ? <Panel className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-sm font-semibold">الاستهلاك حسب النموذج</p><p className="mt-1 text-xs leading-5 text-muted-foreground">الرموز هي القيم التي أبلغ عنها المزود فعلًا؛ لا تتضمن تسعيرًا تقديريًا أو بيانات غير متاحة.</p></div><Badge variant="outline" className="border-border/70 bg-card/70">{formatValue(data.models.length, 0)} نموذج/نماذج</Badge></div><ChartContainer id="admin-ai-model-usage" config={usageChartConfig} className="mt-4 h-56 w-full"><BarChart accessibilityLayer data={data.models.slice(0, 8).map(item => ({ ...item, label: `${item.provider} · ${item.model}` }))} margin={{ right: 8, left: 12 }}><XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} angle={-22} textAnchor="end" height={58} className="text-[10px]" /><YAxis tickLine={false} axisLine={false} width={48} className="text-[10px]" /><ChartTooltip content={<ChartTooltipContent hideLabel />} /><Bar dataKey="totalTokens" radius={6} fill="var(--color-totalTokens)" /></BarChart></ChartContainer><div className="mt-3 space-y-2">{data.models.map(item => <div key={`${item.provider}-${item.model}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border/60 bg-muted/25 px-3 py-2 text-xs"><span className="font-mono text-foreground">{item.provider} · {item.model}</span><span className="text-muted-foreground">{formatValue(item.requests, 0)} طلب · {formatValue(item.reportedUsageRequests, 0)} أبلغت عن الرموز · <strong className="text-foreground">{formatValue(item.totalTokens, 0)} رمز</strong></span></div>)}</div></Panel> : <Panel className="border-dashed"><div className="flex min-h-28 items-center justify-center text-center text-sm text-muted-foreground">لا توجد طلبات نماذج مسجلة في آخر {data.periodDays} أيام. ستبدأ المراقبة من الطلبات التالية بعد تشغيل هذا التحديث.</div></Panel>}
    </> : null}
  </section>;
}

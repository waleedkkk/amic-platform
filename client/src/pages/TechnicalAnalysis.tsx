import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CandlestickChart as PriceChart } from "@/components/CandlestickChart";
import { ConfluenceBreakdownPanel } from "@/components/ConfluenceBreakdownPanel";
import { SessionHeatmapPanel } from "@/components/SessionHeatmapPanel";
import { SUGGESTED_SYMBOLS, SymbolSelect } from "@/components/SymbolSelect";
import { formatValue, LoadState, MetricCard, PageHeading, Panel, SignalBadge } from "@/components/market-ui";
import { createSavedAnalysisPayload, getTechnicalDetailGroups, getTechnicalMetricCards, getUnavailableMetricLabels } from "@/lib/technicalAnalysisViewModel";
import { trpc } from "@/lib/trpc";
import { makeAnalysisTradeDraft, storePaperTradeDraft, suggestRiskLevels } from "@/lib/paperTradeDraft";
import type { MovingAverageCrossover } from "@shared/movingAverageCrossover";
import { BookmarkPlus, CandlestickChart as CandleIcon, ChartNoAxesCombined, CircleGauge, Clock3, RefreshCw, Waves } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

const timeframes = ["15m", "1h", "4h", "1D", "1W"] as const;
type DetectedCrossover = MovingAverageCrossover & { interval: string };

function metricIcon(id: "price" | "rsi" | "macd" | "bollinger") {
  if (id === "price") return <CandleIcon className="size-4 text-sky-300" />;
  if (id === "rsi") return <CircleGauge className="size-4 text-amber-300" />;
  if (id === "macd") return <ChartNoAxesCombined className="size-4 text-violet-300" />;
  return <Waves className="size-4 text-cyan-300" />;
}

export default function TechnicalAnalysis() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h" as (typeof timeframes)[number] });
  const [params, setParams] = useState(form);
  const query = trpc.market.analysis.useQuery(useMemo(() => params, [params]), { refetchOnWindowFocus: true, refetchInterval: 60_000 });
  const saveSignal = trpc.signals.save.useMutation({
    onSuccess: () => toast.success("حُفظت الإشارة في سجلك الخاص."),
    onError: error => toast.error(error.message),
  });
  const [movingAverageCrossover, setMovingAverageCrossover] = useState<DetectedCrossover | null>(null);
  const data = query.data;
  const recommendation = data?.recommendation.signal;
  const price = data?.price.current ?? data?.price.close ?? null;
  const supportLevels = data?.levels.supports;
  const resistanceLevels = data?.levels.resistances;
  const metrics = data ? getTechnicalMetricCards(data) : [];
  const detailGroups = data ? getTechnicalDetailGroups(data) : [];
  const unavailableMetrics = data ? getUnavailableMetricLabels(data) : [];
  const confidence = data?.recommendation.confidence ?? 0;
  const updatedAt = query.dataUpdatedAt ? new Date(query.dataUpdatedAt) : null;
  const chartRiskLevels = useMemo(() => {
    const side = String(recommendation ?? "").toLowerCase().replace(/[ -]/g, "_");
    const normalizedSide = ["buy", "strong_buy", "bullish", "long"].includes(side) ? "long" : ["sell", "strong_sell", "bearish", "short"].includes(side) ? "short" : null;
    return normalizedSide && price !== null && Number.isFinite(price) && price > 0
      ? suggestRiskLevels(normalizedSide, price, { supportLevels, resistanceLevels })
      : null;
  }, [price, recommendation, resistanceLevels, supportLevels]);

  const handleCrossoverChange = useCallback((crossover: MovingAverageCrossover | null, interval: string) => {
    setMovingAverageCrossover(previous => {
      const next = crossover ? { ...crossover, interval } : null;
      const unchanged = previous?.kind === next?.kind && previous?.crossedAt === next?.crossedAt && previous?.interval === next?.interval;
      return unchanged ? previous : next;
    });
  }, []);

  const handleSave = () => {
    if (!data) return toast.error("انتظر وصول التحليل قبل حفظ الإشارة.");
    const normalized = String(recommendation ?? "neutral").toLowerCase().replace(/[ -]/g, "_");
    const recommendationValue = ["strong_buy", "buy", "neutral", "sell", "strong_sell"].includes(normalized)
      ? normalized as "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell"
      : "neutral";
    const crossoverLabel = movingAverageCrossover?.kind === "golden"
      ? "التقاطع الذهبي (SMA 20 فوق SMA 50)"
      : movingAverageCrossover?.kind === "death"
        ? "تقاطع الموت (SMA 20 دون SMA 50)"
        : null;
    saveSignal.mutate({
      symbol: params.symbol,
      exchange: params.exchange,
      timeframe: params.timeframe,
      recommendation: recommendationValue,
      confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 0,
      summary: `قراءة ${params.symbol} على ${params.timeframe}: ${String(recommendation ?? "غير محدد")}${crossoverLabel ? ` · ${crossoverLabel}` : ""}`,
      analysisPayload: createSavedAnalysisPayload(data, movingAverageCrossover),
    });
  };

  const handlePaperTrade = () => {
    const draft = makeAnalysisTradeDraft({
      symbol: params.symbol,
      exchange: params.exchange,
      recommendation,
      price,
      supportLevels,
      resistanceLevels,
      note: `مسودة من التحليل الفني ${params.timeframe}.`,
    });
    if (!draft) return toast.error("تحتاج القراءة إلى توصية صريحة وسعر صالح قبل إنشاء مسودة صفقة.");
    storePaperTradeDraft(draft);
    navigate("/paper-trading");
  };

  return (
    <>
      <PageHeading
        eyebrow="TECHNICAL LAB"
        title="التحليل الفني"
        description="اقرأ البنية الفنية لأصل محدد عبر عقد مؤشرات موحّد ثابت، دون اعتماد الواجهة على أسماء مزود البيانات الخام."
        action={<Button asChild variant="outline" className="max-w-full whitespace-normal bg-white/[0.03]"><Link href="/confluence">تحليل متعدد الأطر <ChartNoAxesCombined className="mr-2 size-4 shrink-0" /></Link></Button>}
      />
      <Panel className="p-3.5 sm:p-4">
        <form className="grid gap-3 md:grid-cols-4" onSubmit={event => { event.preventDefault(); setParams(form); }}>
          <SymbolSelect label="الرمز" value={form.symbol} onChange={symbol => setForm({ ...form, symbol })} onSelect={symbol => {
            const entry = SUGGESTED_SYMBOLS.find((item: { symbol: string; exchange: string }) => item.symbol === symbol);
            if (entry) setForm(prev => ({ ...prev, exchange: entry.exchange }));
          }} />
          <div><Label>البورصة</Label><Input className="mt-2 bg-white/[0.025] font-mono" value={form.exchange} onChange={event => setForm({ ...form, exchange: event.target.value.toUpperCase() })} /></div>
          <div><Label>الإطار الزمني</Label><Select value={form.timeframe} onValueChange={value => setForm({ ...form, timeframe: value as (typeof timeframes)[number] })}><SelectTrigger className="mt-2 bg-white/[0.025]"><SelectValue /></SelectTrigger><SelectContent>{timeframes.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div className="flex items-end gap-2"><Button type="submit" className="flex-1">تحليل الرمز <CandleIcon className="mr-2 size-4" /></Button><Button type="button" variant="outline" className="shrink-0" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="تحديث التحليل"><RefreshCw className={query.isFetching ? "size-4 animate-spin" : "size-4"} /></Button></div>
        </form>
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><Clock3 className="size-3.5" /><span>{updatedAt ? `آخر تحديث ${updatedAt.toLocaleTimeString("ar-EG")}` : "بانتظار أول تحديث"}</span><span>· تُحدَّث البيانات تلقائيًا كل دقيقة وقد تكون مؤجلة أو مخزنة مؤقتًا.</span></div>
      </Panel>

      <div className="mt-6">
        <LoadState loading={query.isLoading} error={query.error}>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {metrics.map(metric => <MetricCard key={metric.id} label={metric.label} value={formatValue(metric.value, metric.digits)} detail={metric.detail} icon={metricIcon(metric.id)} />)}
          </div>
          <PriceChart symbol={params.symbol} exchange={params.exchange} onCrossoverChange={handleCrossoverChange} proposedRiskLevels={chartRiskLevels} />
          <ConfluenceBreakdownPanel symbol={params.symbol} exchange={params.exchange} interval={params.timeframe === "1h" ? "60m" : params.timeframe === "1D" ? "1d" : params.timeframe === "1W" ? "1wk" : params.timeframe} />
          <SessionHeatmapPanel symbol={params.symbol} exchange={params.exchange} />
          {unavailableMetrics.length > 0 ? <div className="mt-4 rounded-xl border border-amber-400/25 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">تعذّر على مزود التحليل تقديم {unavailableMetrics.join("، ")} لهذه القراءة. تبقى بقية بيانات التحليل متاحة، ويمكنك إعادة التحديث أو تجربة إطار آخر.</div> : null}

          {detailGroups.length > 0 ? <section className="mt-6 grid gap-4 lg:grid-cols-3" aria-label="تفاصيل المؤشرات المعيارية">
            {detailGroups.map(group => <Panel key={group.id}><p className="text-xs font-semibold tracking-[0.13em] text-primary">{group.title}</p><dl className="mt-4 space-y-2.5">{group.items.map(item => <div key={item.label} className="flex items-center justify-between gap-3 border-b border-white/[0.06] pb-2.5 last:border-0 last:pb-0"><dt className="text-xs text-muted-foreground">{item.label}</dt><dd className="font-mono text-sm text-foreground">{formatValue(item.value, item.digits ?? 2)}</dd></div>)}</dl></Panel>)}
          </section> : null}

          <div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]">
            <Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">SIGNAL READOUT</p><div className="mt-4 flex flex-wrap items-center gap-3"><SignalBadge value={recommendation} /><span className="text-sm text-muted-foreground">مخرجات معيارية موحدة من مزود التحليل الحالي للأصل والإطار المحددين.</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{metrics.slice(1).map(metric => <div key={metric.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{metric.id}</p><p className="mt-3 font-mono text-lg">{formatValue(metric.value, metric.digits)}</p></div>)}</div></Panel>
            <Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">KEEP THE CONTEXT</p><h2 className="mt-3 text-xl font-semibold">حفظ الإشارة أو تحويلها</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">يحفظ السجل نسخة ذات إصدار من عقد التحليل مع سياق المخطط. لا تُرسل أي أوامر حقيقية ولا تمثل القيم الافتراضية توصية استثمارية.</p><div className="mt-6 grid gap-2"><Button onClick={handleSave} disabled={saveSignal.isPending || !data}><BookmarkPlus className="ml-2 size-4" />حفظ في سجل الإشارات</Button><Button variant="outline" onClick={handlePaperTrade} disabled={!data} className="bg-white/[0.03]">فتح مسودة صفقة ورقية</Button></div></Panel>
          </div>
        </LoadState>
      </div>
    </>
  );
}

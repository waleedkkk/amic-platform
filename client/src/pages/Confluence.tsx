import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUGGESTED_SYMBOLS, SymbolSelect } from "@/components/SymbolSelect";
import { formatValue, LoadState, MetricCard, PageHeading, Panel, SignalBadge } from "@/components/market-ui";
import { describeConfluenceFrame, getConfluenceReferencePrice } from "@/lib/technicalAnalysisViewModel";
import { trpc } from "@/lib/trpc";
import { makeAnalysisTradeDraft, storePaperTradeDraft } from "@/lib/paperTradeDraft";
import { ChartNoAxesCombined, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

const frames = ["15m", "1h", "4h", "1D", "1W"];

export default function Confluence() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ symbol: "BTCUSDT", exchange: "BINANCE" });
  const [params, setParams] = useState(form);
  const query = trpc.market.multiTimeframe.useQuery(useMemo(() => params, [params]), { refetchOnWindowFocus: false });
  const quote = trpc.market.liveQuote.useQuery(params, { enabled: Boolean(params.symbol && params.exchange), refetchOnWindowFocus: true });
  const data = query.data;
  const timeframes = data?.frames ?? {};
  const aggregateSignal = data?.recommendation.signal;
  const supportLevels = data?.levels.supports;
  const resistanceLevels = data?.levels.resistances;
  const contractPrice = data ? getConfluenceReferencePrice(data) : null;
  const referencePrice = quote.data?.price ?? contractPrice?.price ?? null;
  const priceSource = quote.data?.price ? "اقتباس حي" : contractPrice ? `سعر مرجعي من ${contractPrice.timeframe}` : "غير متاح";

  const handlePaperTrade = () => {
    const draft = makeAnalysisTradeDraft({ symbol: params.symbol, exchange: params.exchange, recommendation: aggregateSignal, price: referencePrice, supportLevels, resistanceLevels, note: "مسودة من توافق الأطر الزمنية." });
    if (!draft) return toast.error("تحتاج قراءة التوافق إلى اتجاه صريح وسعر سوق متاح قبل إنشاء مسودة.");
    storePaperTradeDraft(draft);
    navigate("/paper-trading");
  };

  return (
    <>
      <PageHeading eyebrow="CONFLUENCE ENGINE" title="توافق الأطر الزمنية" description="قراءة مركّبة لاتجاه الأصل عبر أطر معيارية ثابتة لتحديد مدى اتساق السياق الفني." />
      <Panel><form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={event => { event.preventDefault(); setParams(form); }}><SymbolSelect label="الرمز" value={form.symbol} onChange={symbol => setForm({ ...form, symbol })} onSelect={symbol => { const entry = SUGGESTED_SYMBOLS.find((item: { symbol: string; exchange: string }) => item.symbol === symbol); if (entry) setForm(prev => ({ ...prev, exchange: entry.exchange })); }} /><div><Label>البورصة</Label><Input value={form.exchange} className="mt-2 bg-white/[0.025] font-mono" onChange={event => setForm({ ...form, exchange: event.target.value.toUpperCase() })} /></div><div className="flex items-end"><Button type="submit" className="w-full">فحص التوافق <Search className="mr-2 size-4" /></Button></div></form></Panel>
      <div className="mt-6"><LoadState loading={query.isLoading} error={query.error}>
        <div className="grid gap-4 md:grid-cols-5">{frames.map(frame => <MetricCard key={frame} label={frame} value={describeConfluenceFrame(timeframes[frame])} detail="قراءة الإطار" icon={<ChartNoAxesCombined className="size-4 text-primary" />} />)}</div>
        <div className="mt-6 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">AGGREGATE READ</p><div className="mt-4"><SignalBadge value={aggregateSignal ?? "لم تُجمع قراءة بعد"} /></div><p className="mt-4 text-sm leading-7 text-muted-foreground">يُظهر هذا الملخص العقد المعياري الثابت للتحليل متعدد الأطر، ويُستخدم كسياق تعليمي لا كتعليمات تداول.</p><p className="mt-3 font-mono text-xs text-muted-foreground">السعر المرجعي: {referencePrice ? formatValue(referencePrice, 6) : "غير متاح"} · {priceSource}</p><Button variant="outline" onClick={handlePaperTrade} disabled={!data || !referencePrice} className="mt-5 w-full bg-white/[0.03]">فتح مسودة صفقة ورقية من التوافق</Button></Panel>
          <Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">CONTRACT STATUS</p><div className="mt-4 grid gap-3 sm:grid-cols-3"><MetricCard label="الإصدار" value={data?.schemaVersion ?? "—"} detail="عقد توافق الأطر" /><MetricCard label="المصدر" value={data?.source ?? "—"} detail="مصدر التحليل" /><MetricCard label="الدرجة الصافية" value={formatValue(data?.alignment.netScore, 2)} detail={data?.alignment.status ?? "حالة التوافق"} /></div><p className="mt-4 text-xs leading-6 text-muted-foreground">الأطر المتعارضة: {data?.alignment.divergentTimeframes.length ? data.alignment.divergentTimeframes.join("، ") : "لا توجد أطر متعارضة مُبلّغ عنها"}</p>{data?.recommendation.rules.length ? <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-muted-foreground">{data.recommendation.rules.map(rule => <li key={rule}>{rule}</li>)}</ul> : null}</Panel>
        </div>
        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="تفاصيل الأطر الزمنية المعيارية">
          {frames.map(frame => {
            const item = timeframes[frame];
            return <Panel key={frame}><div className="flex items-center justify-between gap-3"><h2 className="font-semibold">إطار {frame}</h2><SignalBadge value={item?.bias ?? item?.marketStructure} /></div><dl className="mt-4 space-y-2.5 text-sm"><div className="flex justify-between gap-3"><dt className="text-muted-foreground">الدرجة</dt><dd className="font-mono">{formatValue(item?.score, 2)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">السعر</dt><dd className="font-mono">{formatValue(item?.price, 6)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">RSI</dt><dd className="font-mono">{formatValue(item?.rsi, 2)}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">MACD</dt><dd>{item?.macdCrossover ?? "—"}</dd></div><div className="flex justify-between gap-3"><dt className="text-muted-foreground">قوة الاتجاه</dt><dd>{item?.trendStrength ?? "—"}</dd></div></dl>{item?.advice ? <p className="mt-4 rounded-lg bg-white/[0.03] p-3 text-xs leading-6 text-muted-foreground">{item.advice}</p> : null}{item?.keyIndicators.length ? <p className="mt-3 text-xs text-primary">{item.keyIndicators.join(" · ")}</p> : null}</Panel>;
          })}
        </section>
      </LoadState></div>
    </>
  );
}

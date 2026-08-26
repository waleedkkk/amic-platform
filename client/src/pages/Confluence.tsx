import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { LazyConfluenceBreakdownPanel } from "@/components/LazyConfluenceBreakdownPanel";
import { ContextHelp } from "@/components/ContextHelp";
import { Label } from "@/components/ui/label";
import { SUGGESTED_SYMBOLS, SymbolSelect } from "@/components/SymbolSelect";
import { formatValue, LoadState, PageHeading, Panel, SignalBadge } from "@/components/market-ui";
import { describeConfluenceFrame, resolveConfluenceDisplayPrice } from "@/lib/technicalAnalysisViewModel";
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
  const resolvedPrice = data ? resolveConfluenceDisplayPrice(quote.data?.price, data) : { price: null, source: "unavailable" as const, timeframe: null };
  const referencePrice = resolvedPrice.price;
  const priceSource = resolvedPrice.source === "live" ? "اقتباس حي" : resolvedPrice.source === "frame" ? `سعر مرجعي من ${resolvedPrice.timeframe}` : "غير متاح";
  const saveSignal = trpc.signals.save.useMutation({ onError: error => toast.error(error.message) });

  const handlePaperTrade = async () => {
    const draft = makeAnalysisTradeDraft({ symbol: params.symbol, exchange: params.exchange, recommendation: aggregateSignal, price: referencePrice, supportLevels, resistanceLevels, note: "مسودة من توافق الأطر الزمنية." });
    if (!draft) return toast.error("تحتاج قراءة التوافق إلى اتجاه صريح وسعر سوق متاح قبل إنشاء مسودة.");
    if (!data) return toast.error("انتظر وصول قراءة التوافق قبل إنشاء مسودة صفقة.");
    const normalized = String(aggregateSignal ?? "neutral").toLowerCase().replace(/[ -]/g, "_");
    const recommendation = ["strong_buy", "buy", "neutral", "sell", "strong_sell"].includes(normalized)
      ? normalized as "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell"
      : "neutral";
    try {
      const signal = await saveSignal.mutateAsync({
        symbol: params.symbol,
        exchange: params.exchange,
        timeframe: data.recommendation.entryTimeframe ?? "MULTI",
        recommendation,
        confidence: 0,
        summary: data.recommendation.summary ?? `قراءة توافق الأطر لـ ${params.symbol}.`,
        analysisPayload: { sourceType: "multi_timeframe", analysis: data, referencePrice, priceSource },
      });
      storePaperTradeDraft({ ...draft, signalId: signal.id });
      toast.success("حُفظ سياق التوافق ورُبط بمسودة الصفقة.");
      navigate("/paper-trading");
    } catch {
      // يعرض مسار mutation رسالة الخطأ؛ لا تنتقل إلى نموذج بلا ربط صريح.
    }
  };

  return (
    <>
      <PageHeading eyebrow="CONFLUENCE ENGINE" title="توافق الأطر الزمنية" description="اختر أصلًا، راجع خريطة الأطر والملخص المجمع، ثم افتح مسودة ورقية فقط عند فهم التعارضات والمخاطر. القراءة تعليمية وليست توصية." />
      <Panel><form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={event => { event.preventDefault(); setParams(form); }}><SymbolSelect label="الرمز" value={form.symbol} onChange={symbol => setForm({ ...form, symbol })} onSelect={symbol => { const entry = SUGGESTED_SYMBOLS.find((item: { symbol: string; exchange: string }) => item.symbol === symbol); if (entry) setForm(prev => ({ ...prev, exchange: entry.exchange })); }} /><div><Label>البورصة</Label><Input value={form.exchange} className="mt-2 bg-white/[0.025] font-mono" onChange={event => setForm({ ...form, exchange: event.target.value.toUpperCase() })} /></div><div className="flex items-end"><Button type="submit" className="w-full">فحص التوافق <Search className="mr-2 size-4" /></Button></div></form></Panel>
      <div className="mt-6"><LoadState loading={query.isLoading} error={query.error}>
        <Panel className="p-3.5"><div className="flex flex-wrap items-center gap-2"><div className="flex items-center gap-1"><h2 className="text-sm font-semibold">خريطة الأطر</h2><ContextHelp term="توافق الأطر الزمنية"><p>تقارن الصفحة اتجاه الأصل عبر فترات زمنية مختلفة. توافق الأطر لا يضمن النتيجة؛ بل يوضح إن كانت القراءات متسقة أو متعارضة.</p></ContextHelp></div>{frames.map(frame => <span key={frame} className="inline-flex items-center gap-1.5 rounded-full border border-white/[0.08] bg-white/[0.025] px-2.5 py-1 text-xs"><ChartNoAxesCombined className="size-3 text-primary" /><span className="font-mono text-muted-foreground">{frame}</span><span>{describeConfluenceFrame(timeframes[frame])}</span></span>)}</div><p className="mt-2 text-xs text-muted-foreground">القيم التفصيلية لكل إطار تظهر مرة واحدة في البطاقات أدناه.</p></Panel>
        <div className="mt-6 grid gap-4 lg:grid-cols-[0.75fr_1.25fr]">
          <Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">ملخص مجمع</p><div className="mt-4"><SignalBadge value={aggregateSignal ?? "لم تُجمع قراءة بعد"} /></div><p className="mt-4 text-sm leading-7 text-muted-foreground">هذه خلاصة اتجاهات الأطر، وتُستخدم كسياق تعليمي لا كتعليمات تداول. راجع التعارضات والقيم التفصيلية قبل تحويلها إلى مسودة.</p><p className="mt-3 font-mono text-xs text-muted-foreground">السعر المرجعي: {referencePrice ? formatValue(referencePrice, 6) : "غير متاح"} · {priceSource}</p><Button variant="outline" onClick={() => { void handlePaperTrade(); }} disabled={!data || !referencePrice || saveSignal.isPending} className="mt-5 w-full bg-white/[0.03]">فتح مسودة صفقة ورقية من التوافق</Button></Panel>
          <Panel><div className="flex items-center gap-1"><p className="text-xs font-semibold tracking-[0.13em] text-primary">اتساق القراءة</p><ContextHelp term="الدرجة الصافية"><p>تلخص مقدار اتفاق الأطر وفق منطق المصدر. استخدمها مع قائمة الأطر المتعارضة، لا كإشارة مستقلة لفتح صفقة.</p></ContextHelp></div><dl className="mt-4 grid gap-3 sm:grid-cols-2"><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><dt className="text-xs text-muted-foreground">الدرجة الصافية</dt><dd className="mt-2 font-mono text-lg">{formatValue(data?.alignment.netScore, 2)}</dd><p className="mt-1 text-xs text-muted-foreground">{data?.alignment.status ?? "حالة التوافق"}</p></div><div className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-3"><dt className="text-xs text-muted-foreground">الأطر المتعارضة</dt><dd className="mt-2 text-sm">{data?.alignment.divergentTimeframes.length ? data.alignment.divergentTimeframes.join("، ") : "لا توجد أطر متعارضة مُبلّغ عنها"}</dd></div></dl><p className="mt-4 text-xs text-muted-foreground">المصدر: {data?.source ?? "—"}</p>{data?.recommendation.rules.length ? <ul className="mt-4 list-inside list-disc space-y-1 text-sm text-muted-foreground">{data.recommendation.rules.map(rule => <li key={rule}>{rule}</li>)}</ul> : null}</Panel>
        </div>
        <LazyConfluenceBreakdownPanel symbol={params.symbol} exchange={params.exchange} />
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

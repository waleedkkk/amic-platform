import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CandlestickChart as PriceChart } from "@/components/CandlestickChart";
import { SUGGESTED_SYMBOLS, SymbolSelect } from "@/components/SymbolSelect";
import { asRows, findValue, formatValue, LoadState, MetricCard, PageHeading, Panel, safeRecord, SignalBadge } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { BookmarkPlus, CandlestickChart as CandleIcon, ChartNoAxesCombined, CircleGauge, Waves } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "wouter";

const timeframes = ["15m", "1h", "4h", "1D", "1W"] as const;

export default function TechnicalAnalysis() {
  const [form, setForm] = useState({ symbol: "BTCUSDT", exchange: "BINANCE", timeframe: "1h" as (typeof timeframes)[number] });
  const [params, setParams] = useState(form);
  const query = trpc.market.analysis.useQuery(useMemo(() => params, [params]), { refetchOnWindowFocus: false });
  const saveSignal = trpc.signals.save.useMutation({ onSuccess: () => toast.success("حُفظت الإشارة في سجلك الخاص."), onError: error => toast.error(error.message) });
  const data = query.data;
  const recommendation = findValue(data, ["recommendation", "signal", "rating"]);
  const rsi = findValue(data, ["rsi", "RSI"]);
  const macd = findValue(data, ["macd", "MACD"]);
  const bollinger = findValue(data, ["bollinger", "BB", "bbw"]);
  const price = findValue(data, ["price", "close", "last"]);
  const confidence = Number(findValue(data, ["confidence", "confluence_score", "score"]) ?? 0);
  const handleSave = () => {
    const analysisPayload = safeRecord(data);
    if (!Object.keys(analysisPayload).length) return toast.error("انتظر وصول التحليل قبل حفظ الإشارة.");
    const normalized = String(recommendation ?? "neutral").toLowerCase().replace(/[ -]/g, "_");
    const recommendationValue = ["strong_buy", "buy", "neutral", "sell", "strong_sell"].includes(normalized) ? normalized as "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell" : "neutral";
    saveSignal.mutate({ symbol: params.symbol, exchange: params.exchange, timeframe: params.timeframe, recommendation: recommendationValue, confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(100, confidence)) : 0, summary: `قراءة ${params.symbol} على ${params.timeframe}: ${String(recommendation ?? "غير محدد")}`, analysisPayload });
  };
  return <>
    <PageHeading eyebrow="TECHNICAL LAB" title="التحليل الفني" description="اقرأ البنية الفنية لأصل محدد عبر مؤشرات الزخم والتذبذب والتوصية التي يعيدها مزود التحليل." action={<Button asChild variant="outline" className="max-w-full whitespace-normal bg-white/[0.03]"><Link href="/confluence">تحليل متعدد الأطر <ChartNoAxesCombined className="mr-2 size-4 shrink-0" /></Link></Button>} />
    <Panel><form className="grid gap-4 md:grid-cols-4" onSubmit={event => { event.preventDefault(); setParams(form); }}><SymbolSelect label="الرمز" value={form.symbol} className="" onChange={symbol => setForm({ ...form, symbol })} onSelect={symbol => { const entry = SUGGESTED_SYMBOLS.find((item: { symbol: string; exchange: string }) => item.symbol === symbol); if (entry) setForm(prev => ({ ...prev, exchange: entry.exchange })); }} /><div><Label>البورصة</Label><Input className="mt-2 bg-white/[0.025] font-mono" value={form.exchange} onChange={event => setForm({ ...form, exchange: event.target.value.toUpperCase() })} /></div><div><Label>الإطار الزمني</Label><Select value={form.timeframe} onValueChange={value => setForm({ ...form, timeframe: value as (typeof timeframes)[number] })}><SelectTrigger className="mt-2 bg-white/[0.025]"><SelectValue /></SelectTrigger><SelectContent>{timeframes.map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div><div className="flex items-end"><Button type="submit" className="w-full">تحليل الرمز <CandleIcon className="mr-2 size-4" /></Button></div></form></Panel>
    <div className="mt-6"><LoadState loading={query.isLoading} error={query.error}><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="السعر / الإغلاق" value={formatValue(price, 6)} detail={`${params.symbol} · ${params.exchange}`} icon={<CandleIcon className="size-4 text-sky-300" />} /><MetricCard label="RSI" value={formatValue(rsi, 2)} detail="مؤشر الزخم النسبي" icon={<CircleGauge className="size-4 text-amber-300" />} /><MetricCard label="MACD" value={formatValue(macd, 4)} detail="فرق المتوسطات المتحركة" icon={<ChartNoAxesCombined className="size-4 text-violet-300" />} /><MetricCard label="Bollinger" value={formatValue(bollinger, 4)} detail="مستوى / عرض نطاقات بولينجر" icon={<Waves className="size-4 text-cyan-300" />} /></div><PriceChart symbol={params.symbol} exchange={params.exchange} />
<div className="mt-6 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"><Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">SIGNAL READOUT</p><div className="mt-4 flex flex-wrap items-center gap-3"><SignalBadge value={recommendation} /><span className="text-sm text-muted-foreground">مخرجات مزود التحليل الحالي للأصل والإطار المحددين.</span></div><div className="mt-6 grid gap-3 sm:grid-cols-3">{["rsi", "macd", "bollinger"].map(key => <div key={key} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><p className="text-xs uppercase tracking-wider text-muted-foreground">{key}</p><p className="mt-3 font-mono text-lg">{formatValue(findValue(data, [key]))}</p></div>)}</div></Panel><Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">KEEP THE CONTEXT</p><h2 className="mt-3 text-xl font-semibold">حفظ الإشارة</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">احفظ ملخص القراءة الحالية في سجلك لمراجعتها لاحقًا ومقارنتها بتطور الصفقة الورقية.</p><Button onClick={handleSave} disabled={saveSignal.isPending || !data} className="mt-6 w-full"><BookmarkPlus className="ml-2 size-4" />حفظ في سجل الإشارات</Button></Panel></div>{asRows(data).length ? <Panel className="mt-4"><p className="mb-3 text-sm font-medium">تفاصيل إضافية من التحليل</p><pre className="max-h-80 overflow-auto rounded-xl bg-black/15 p-4 text-left font-mono text-xs leading-6 text-slate-300" dir="ltr">{JSON.stringify(data, null, 2)}</pre></Panel> : null}</LoadState></div>
  </>;
}

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUGGESTED_SYMBOLS, SymbolSelect } from "@/components/SymbolSelect";
import { formatValue, LoadState, MetricCard, PageHeading, Panel, SignalBadge } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { makeAnalysisTradeDraft, storePaperTradeDraft } from "@/lib/paperTradeDraft";
import { ChartNoAxesCombined, Search } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useLocation } from "wouter";

export default function Confluence() {
  const [, navigate] = useLocation();
  const [form, setForm] = useState({ symbol: "BTCUSDT", exchange: "BINANCE" });
  const [params, setParams] = useState(form);
  const query = trpc.market.multiTimeframe.useQuery(useMemo(() => params, [params]), { refetchOnWindowFocus: false });
  const quote = trpc.market.liveQuote.useQuery(params, { enabled: Boolean(params.symbol && params.exchange), refetchOnWindowFocus: true });
  const data = query.data;
  const timeframes = data?.frames ?? {};
  const frames = ["15m", "1h", "4h", "1D", "1W"];
  const frameSummary = (frame: string) => {
    const tf = timeframes[frame];
    if (!tf) return null;
    const score = tf.score;
    if (score !== null) {
      const label = score > 0.3 ? "صاعد" : score < -0.3 ? "هابط" : "عرضي";
      return `${label} (${score > 0 ? "+" : ""}${score.toFixed(2)})`;
    }
    return tf.bias ?? tf.marketStructure;
  };
  const aggAction = data?.recommendation.signal;
  const supportLevels = data?.levels.supports;
  const resistanceLevels = data?.levels.resistances;
  const handlePaperTrade = () => {
    const draft = makeAnalysisTradeDraft({ symbol: params.symbol, exchange: params.exchange, recommendation: aggAction, price: quote.data?.price, supportLevels, resistanceLevels, note: "مسودة من توافق الأطر الزمنية." });
    if (!draft) return toast.error("تحتاج قراءة التوافق إلى اتجاه صريح وسعر سوق متاح قبل إنشاء المسودة.");
    storePaperTradeDraft(draft);
    navigate("/paper-trading");
  };
  return <><PageHeading eyebrow="CONFLUENCE ENGINE" title="توافق الأطر الزمنية" description="قراءة مركّبة لاتجاه الأصل عبر الأطر القصيرة والمتوسطة والطويلة لتحديد مدى اتساق السياق الفني." /><Panel><form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={event => { event.preventDefault(); setParams(form); }}><SymbolSelect label="الرمز" value={form.symbol} onChange={symbol => setForm({ ...form, symbol })} onSelect={symbol => { const entry = SUGGESTED_SYMBOLS.find((item: { symbol: string; exchange: string }) => item.symbol === symbol); if (entry) setForm(prev => ({ ...prev, exchange: entry.exchange })); }} /><div><Label>البورصة</Label><Input value={form.exchange} className="mt-2 bg-white/[0.025] font-mono" onChange={event => setForm({ ...form, exchange: event.target.value.toUpperCase() })} /></div><div className="flex items-end"><Button type="submit" className="w-full">فحص التوافق <Search className="mr-2 size-4" /></Button></div></form></Panel><div className="mt-6"><LoadState loading={query.isLoading} error={query.error}><div className="grid gap-4 md:grid-cols-5">{frames.map(frame => <MetricCard key={frame} label={frame} value={frameSummary(frame) ?? "—"} detail="قراءة الإطار" icon={<ChartNoAxesCombined className="size-4 text-primary" />} />)}</div><div className="mt-6 grid gap-4 lg:grid-cols-[0.7fr_1.3fr]"><Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">AGGREGATE READ</p><div className="mt-4"><SignalBadge value={aggAction ?? "لم تُجمع قراءة بعد"} /></div><p className="mt-4 text-sm leading-7 text-muted-foreground">يُظهر هذا الملخص العقد المعياري الثابت للتحليل متعدد الأطر، ويُستخدم كقراءة للسياق لا كتعليمات تداول.</p><p className="mt-3 font-mono text-xs text-muted-foreground">السعر الحالي: {quote.data?.price ? formatValue(quote.data.price, 6) : "غير متاح"}</p><Button variant="outline" onClick={handlePaperTrade} disabled={!data || !quote.data?.price} className="mt-5 w-full bg-white/[0.03]">فتح مسودة صفقة ورقية من التوافق</Button></Panel><Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">STANDARDIZED CONTRACT</p><pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-black/15 p-4 text-left font-mono text-xs leading-6 text-slate-300" dir="ltr">{JSON.stringify(data ?? {}, null, 2)}</pre></Panel></div></LoadState></div></>;
}

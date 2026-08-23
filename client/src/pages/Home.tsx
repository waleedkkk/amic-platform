import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { DataTable, EmptyAction, formatValue, MetricCard, PageHeading, Panel, SignalBadge } from "@/components/market-ui";
import { PreciousMetalsWidget } from "@/components/PreciousMetalsWidget";
import { SUGGESTED_SYMBOLS, SymbolSelect } from "@/components/SymbolSelect";
import { saveMarketAssistantContext } from "@/lib/marketAssistantContext";
import { trpc } from "@/lib/trpc";
import { DEFAULT_MARKET_PULSE_SECTIONS, type MarketPulseSectionKey } from "@shared/marketPulsePreferences";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bot, Plus, ScanSearch, Settings2, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { Link, useLocation } from "wouter";
import { useState } from "react";

type PriceRow = { symbol?: string; price?: number; change_pct?: number; currency?: string; changePercent?: number; close?: number; indicators?: { close?: number; RSI?: number; volume?: number } };
type CorrelationMatrixData = { assets: { id: string; label: string }[]; matrix: { id: string; values: (number | null)[] }[]; fetchedAt: string };

function toMarketRows(value: unknown): PriceRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PriceRow => item && typeof item === "object" && !Array.isArray(item));
}

function rowsWithChange(rows: PriceRow[]) {
  return rows.map(row => {
    const close = typeof row.close === "number" ? row.close : row.indicators?.close;
    return {
      symbol: row.symbol ?? "—",
      السعر: typeof row.price === "number" ? row.price : typeof close === "number" ? close : undefined,
      "التغير %": typeof row.change_pct === "number" ? row.change_pct : typeof row.changePercent === "number" ? row.changePercent : undefined,
    };
  });
}

const queryOpts = { refetchInterval: 300_000, refetchOnWindowFocus: false, staleTime: 280_000, retry: 1, retryDelay: 1500 } as const;

const PULSE_SECTIONS: { key: MarketPulseSectionKey; title: string; subtitle: string; negative: boolean; icon: React.ReactNode }[] = [
  { key: "cryptoGainers", title: "أبرز الرابحين — كريبتو", subtitle: "نسبة التغير وفق الإطار اليومي", negative: false, icon: <TrendingUp className="size-5 text-emerald-300" /> },
  { key: "cryptoLosers", title: "أبرز الخاسرين — كريبتو", subtitle: "تحركات تحتاج إلى قراءة حجم وتذبذب", negative: true, icon: <TrendingDown className="size-5 text-rose-300" /> },
  { key: "stockGainers", title: "أبرز الرابحين — أسهم", subtitle: "نتائج الفحص على NASDAQ", negative: false, icon: <TrendingUp className="size-5 text-emerald-300" /> },
  { key: "stockLosers", title: "أبرز الخاسرين — أسهم", subtitle: "نتائج الفحص على NASDAQ", negative: true, icon: <TrendingDown className="size-5 text-rose-300" /> },
];

function SlicePanel({ title, subtitle, rows, negative, loading, error, icon }: {
  title: string; subtitle: string; rows: PriceRow[]; negative?: boolean; loading: boolean; error: unknown; icon: React.ReactNode;
}) {
  const base = rowsWithChange(rows)
    .filter(row => typeof row["التغير %"] === "number")
    .sort((a, b) => (a["التغير %"] as number) - (b["التغير %"] as number));
  const data = (negative ? base : base.slice().reverse()).slice(0, 6);
  if (error) return <Panel className="opacity-70"><div className="flex h-32 items-center justify-center text-sm text-muted-foreground">تعذّر جلب {title} — جرّب إعادة تحميل الصفحة لاحقًا.</div></Panel>;
  return <Panel>
    <div className="mb-4 flex items-start justify-between">
      <div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>
      {loading ? <span className="animate-spin"><Activity className="size-5 text-muted-foreground" /></span> : icon}
    </div>
    {data.length || loading ? <DataTable rows={data} emptyLabel={loading ? "جارٍ جلب النتائج…" : "لا توجد نتائج من المزود الآن."} /> : <div className="h-20 animate-pulse rounded-md bg-white/[0.04]" />}
  </Panel>;
}

function correlationClass(value: number | null) {
  if (value === null) return "bg-white/[0.03] text-muted-foreground";
  if (value >= 0.65) return "bg-emerald-400/25 text-emerald-100";
  if (value >= 0.25) return "bg-emerald-400/10 text-emerald-200";
  if (value <= -0.65) return "bg-rose-400/25 text-rose-100";
  if (value <= -0.25) return "bg-rose-400/10 text-rose-200";
  return "bg-white/[0.05] text-muted-foreground";
}

function CorrelationMatrixPanel({ data, loading, error }: { data?: CorrelationMatrixData; loading: boolean; error: unknown }) {
  return <Panel className="mt-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-primary">MARKET RELATIONSHIPS</p><h2 className="mt-2 text-xl font-semibold">مصفوفة ارتباط الأصول</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">ارتباط Pearson لعوائد الإغلاق اليومية خلال التاريخ المتاح؛ لا يعني علاقة سببية.</p></div>{loading ? <Activity className="size-5 animate-spin text-muted-foreground" /> : <BarChart3 className="size-5 text-primary" />}</div>{error ? <p className="mt-5 text-sm text-muted-foreground">تعذّر حساب مصفوفة الارتباط الآن.</p> : data?.assets.length ? <div className="mt-5 overflow-x-auto"><table className="min-w-[620px] w-full border-separate border-spacing-1 text-center text-xs"><thead><tr><th className="p-2 text-right text-muted-foreground">الأصل</th>{data.assets.map(asset => <th key={asset.id} className="p-2 font-medium text-muted-foreground">{asset.label}</th>)}</tr></thead><tbody>{data.matrix.map((row, index) => <tr key={row.id}><th className="p-2 text-right font-medium">{data.assets[index]?.label}</th>{row.values.map((value, valueIndex) => <td key={`${row.id}-${data.assets[valueIndex]?.id}`}><span className={`block rounded-md px-2 py-2 font-mono ${correlationClass(value)}`}>{value === null ? "—" : value.toFixed(2)}</span></td>)}</tr>)}</tbody></table></div> : <p className="mt-5 text-sm text-muted-foreground">جارٍ انتظار بيانات كافية لحساب الارتباطات.</p>}</Panel>;
}

export default function Home() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [pulseDialogOpen, setPulseDialogOpen] = useState(false);
  const [watchSymbol, setWatchSymbol] = useState("BTCUSDT");
  const [watchExchange, setWatchExchange] = useState("BINANCE");
  const preferencesQuery = trpc.market.pulse.getPreferences.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false });
  const activeSections = preferencesQuery.data?.sections ?? DEFAULT_MARKET_PULSE_SECTIONS;
  const saveSections = trpc.market.pulse.saveSections.useMutation({
    onSuccess: () => void utils.market.pulse.getPreferences.invalidate(),
  });
  const addWatchSymbol = trpc.market.pulse.addSymbol.useMutation({
    onSuccess: () => {
      void utils.market.pulse.getPreferences.invalidate();
      void utils.market.pulse.watchlistQuotes.invalidate();
    },
  });
  const removeWatchSymbol = trpc.market.pulse.removeSymbol.useMutation({
    onSuccess: () => {
      void utils.market.pulse.getPreferences.invalidate();
      void utils.market.pulse.watchlistQuotes.invalidate();
    },
  });
  const watchlistQuotesQuery = trpc.market.pulse.watchlistQuotes.useQuery(undefined, {
    enabled: Boolean(preferencesQuery.data?.watchlist.length),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    staleTime: 45_000,
    retry: 1,
  });

  const snapshotQuery = trpc.market.overviewSlice.useQuery("globalSnapshot", { ...queryOpts, enabled: true });
  const correlationQuery = trpc.market.correlationMatrix.useQuery(undefined, { staleTime: 55 * 60_000, refetchOnWindowFocus: false, retry: 1 });
  const queries = PULSE_SECTIONS.map(s => ({ ...s, query: trpc.market.overviewSlice.useQuery(s.key, { ...queryOpts, enabled: activeSections.includes(s.key) }) }));

  const snapshot = (snapshotQuery.data ?? {}) as { indices?: PriceRow[]; crypto?: PriceRow[]; fx?: PriceRow[]; etfs?: PriceRow[] };
  const indices = snapshot.indices ?? [];
  const fx = snapshot.fx ?? [];
  const etfs = snapshot.etfs ?? [];
  const eurRate = fx.find(row => String(row.symbol ?? "").toUpperCase().startsWith("EUR"));

  const visibleQueries = queries.filter(query => activeSections.includes(query.key));
  const anyLoading = snapshotQuery.isLoading || visibleQueries.some(q => q.query.isLoading);
  const anyData = Boolean(indices.length || etfs.length || visibleQueries.some(q => q.query.data && toMarketRows(q.query.data).length > 0));
  const allFailed = visibleQueries.every(q => q.query.isError) && snapshotQuery.isError;
  const openAssistantWithMarketContext = () => {
    if (typeof window !== "undefined") {
      try {
        saveMarketAssistantContext(window.sessionStorage, {
          globalSnapshot: snapshotQuery.data ?? {},
          cryptoGainers: queries.find(query => query.key === "cryptoGainers")?.query.data ?? [],
          cryptoLosers: queries.find(query => query.key === "cryptoLosers")?.query.data ?? [],
          stockGainers: queries.find(query => query.key === "stockGainers")?.query.data ?? [],
          stockLosers: queries.find(query => query.key === "stockLosers")?.query.data ?? [],
        });
      } catch {
        // يبقى الانتقال متاحًا حتى عند حظر sessionStorage من المتصفح.
      }
    }
    navigate("/assistant");
  };

  return <>
    <PageHeading eyebrow="LIVE MARKET DESK" title="نبضة السوق" description="نظرة عملية على الحركة النسبية عبر الكريبتو والأسهم وأسواق العملات، مع تحديث تلقائي للبيانات المتاحة." action={<div className="flex flex-wrap gap-2"><Dialog open={pulseDialogOpen} onOpenChange={setPulseDialogOpen}><DialogTrigger asChild><Button variant="outline" className="bg-white/[0.03]"><Settings2 className="ml-2 size-4" />تخصيص النبض</Button></DialogTrigger><DialogContent dir="rtl" className="max-h-[88dvh] overflow-y-auto border-white/[0.12] bg-[#09111b] text-foreground sm:max-w-xl"><DialogHeader><DialogTitle>تخصيص نبض السوق</DialogTitle><DialogDescription>اختر الأقسام التي تريد متابعتها، ثم أضف حتى ثمانية رموز أو أزواج خاصة بك. تُحفظ هذه الإعدادات لحسابك فقط.</DialogDescription></DialogHeader><div className="space-y-5"><section><Label className="text-sm">أقسام السوق</Label><div className="mt-3 grid gap-2 sm:grid-cols-2">{PULSE_SECTIONS.map(section => { const checked = activeSections.includes(section.key); return <label key={section.key} className="flex cursor-pointer items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-sm"><Checkbox checked={checked} disabled={saveSections.isPending} onCheckedChange={() => { const next = checked ? activeSections.filter(key => key !== section.key) : [...activeSections, section.key]; if (next.length) saveSections.mutate({ sections: next }); }} /><span>{section.title}</span></label>; })}</div><p className="mt-2 text-xs text-muted-foreground">يجب الإبقاء على قسم واحد على الأقل ظاهرًا.</p></section><section className="border-t border-white/[0.08] pt-5"><div className="flex items-center justify-between gap-3"><Label className="text-sm">رموزي وأزواجي</Label><span className="font-mono text-xs text-muted-foreground">{preferencesQuery.data?.watchlist.length ?? 0}/8</span></div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_auto]"><SymbolSelect label="الرمز" className="sm:col-span-1" value={watchSymbol} onChange={setWatchSymbol} onSelect={symbol => { const entry = SUGGESTED_SYMBOLS.find(item => item.symbol === symbol); if (entry) setWatchExchange(entry.exchange); }} customLabel="رمز مخصص" /><div><Label>البورصة</Label><Input className="mt-2 bg-white/[0.025] font-mono" value={watchExchange} onChange={event => setWatchExchange(event.target.value.toUpperCase())} /></div><Button className="self-end" onClick={() => addWatchSymbol.mutate({ symbol: watchSymbol, exchange: watchExchange })} disabled={addWatchSymbol.isPending || (preferencesQuery.data?.watchlist.length ?? 0) >= 8}><Plus className="ml-1 size-4" />إضافة</Button></div><div className="mt-4 space-y-2">{preferencesQuery.data?.watchlist.length ? preferencesQuery.data.watchlist.map(item => <div key={`${item.exchange}:${item.symbol}`} className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/15 px-3 py-2"><div><span className="font-mono text-sm">{item.symbol}</span><span className="mr-2 text-xs text-muted-foreground">{item.exchange}</span></div><Button size="icon" variant="ghost" aria-label={`حذف ${item.symbol}`} onClick={() => removeWatchSymbol.mutate({ symbol: item.symbol, exchange: item.exchange })} disabled={removeWatchSymbol.isPending}><Trash2 className="size-4 text-rose-300" /></Button></div>) : <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-4 text-center text-sm text-muted-foreground">لم تضف رموزًا شخصية بعد.</p>}</div></section></div></DialogContent></Dialog><Button asChild variant="outline" className="bg-white/[0.03]"><Link href="/screener">ماسح السوق <ScanSearch className="mr-2 size-4" /></Link></Button><Button asChild><Link href="/analysis">بدء تحليل <ArrowUpRight className="mr-2 size-4" /></Link></Button></div>} />
    {allFailed ? <div className="rounded-lg border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-sm text-muted-foreground">تعذّر الوصول إلى مزود بيانات السوق حاليًا — تحقق من اتصالك ثم أعد تحميل الصفحة.</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="رابحو الكريبتو" value={formatValue(toMarketRows(queries[0].query.data).length, 0)} detail="نتائج متاحة على BINANCE" positive icon={<TrendingUp className="size-4 text-emerald-300" />} /><MetricCard label="خاسرو الكريبتو" value={formatValue(toMarketRows(queries[1].query.data).length, 0)} detail="نتائج متاحة على BINANCE" positive={false} icon={<TrendingDown className="size-4 text-rose-300" />} /><MetricCard label="حركة المؤشرات" value={formatValue(indices.length, 0)} detail="مؤشرات عالمية نشطة" icon={<BarChart3 className="size-4 text-sky-300" />} /><MetricCard label="لقطة العملات" value={eurRate?.price ? formatValue(eurRate.price, 4) : "—"} detail={eurRate?.price ? `EUR/USD من ملخص السوق العالمي` : "من ملخص السوق العالمي"} icon={<Activity className="size-4 text-amber-300" />} /></div>}
    <div className="mt-6"><PreciousMetalsWidget /></div>
    {preferencesQuery.data?.watchlist.length ? <Panel className="mt-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-primary">MY MARKET PULSE</p><h2 className="mt-2 text-xl font-semibold">رموزك المختارة</h2><p className="mt-1 text-xs text-muted-foreground">لقطة شخصية مختصرة تُحدّث تلقائيًا كل دقيقة.</p></div><Button variant="outline" size="sm" className="bg-white/[0.03]" onClick={() => setPulseDialogOpen(true)}><Settings2 className="ml-2 size-3.5" />تعديل</Button></div>{watchlistQuotesQuery.isLoading ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{preferencesQuery.data.watchlist.map(item => <div key={`${item.exchange}:${item.symbol}`} className="h-28 animate-pulse rounded-xl bg-white/[0.04]" />)}</div> : watchlistQuotesQuery.isError ? <p className="mt-5 text-sm text-muted-foreground">تعذّر تحديث رموزك الآن، لكن اختيارك ما زال محفوظًا ويمكنك إعادة المحاولة بعد قليل.</p> : <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(watchlistQuotesQuery.data ?? []).map(item => <div key={`${item.exchange}:${item.symbol}`} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-mono font-semibold">{item.symbol}</p><p className="mt-1 text-xs text-muted-foreground">{item.exchange}</p></div><SignalBadge value={item.recommendation} /></div><p className="mt-4 font-mono text-lg">{item.price === null ? "—" : formatValue(item.price, 4)}</p><p className={`mt-1 text-xs ${typeof item.changePercent === "number" && item.changePercent < 0 ? "text-rose-300" : "text-emerald-300"}`}>{typeof item.changePercent === "number" ? `${item.changePercent >= 0 ? "+" : ""}${formatValue(item.changePercent, 2)}%` : "التغير غير متاح"}</p></div>)}</div>}</Panel> : null}
    <CorrelationMatrixPanel data={correlationQuery.data} loading={correlationQuery.isLoading} error={correlationQuery.error} />
    {anyLoading && !anyData ? <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Activity className="size-4 animate-spin" /> جارٍ جلب بيانات السوق…</div> : null}
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      {visibleQueries.map(({ key, title, subtitle, negative, icon, query }) => (
        <SlicePanel key={key} title={title} subtitle={subtitle} negative={negative} loading={query.isLoading} error={query.error} icon={icon} rows={toMarketRows(query.data)} />
      ))}
    </div>
    <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]"><Panel><div className="flex items-start justify-between"><div><p className="text-xs font-semibold tracking-[0.12em] text-primary">GLOBAL SNAPSHOT</p><h2 className="mt-2 text-xl font-semibold">ملخص السياق الكلي</h2></div>{snapshotQuery.isLoading ? <span className="animate-spin"><Activity className="size-5 text-muted-foreground" /></span> : <Activity className="size-5 text-primary" />}</div><div className="mt-5"><DataTable rows={[...rowsWithChange(indices), ...rowsWithChange(snapshot.crypto ?? []), ...rowsWithChange(fx).slice(0, 3), ...rowsWithChange(etfs)]} emptyLabel={snapshotQuery.isLoading ? "جارٍ جلب ملخص السوق العالمي…" : "تظهر المؤشرات العالمية عند استجابة مزود البيانات."} /></div></Panel><Panel className="flex flex-col justify-between"><div><Bot className="size-6 text-primary" /><h2 className="mt-5 text-xl font-semibold">حوّل الأرقام إلى سياق</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">استخدم المساعد لتفسير مؤشراتك وأسئلتك مع تنبيه واضح بأن المخرجات معلوماتية وليست نصيحة استثمارية.</p></div><Button className="mt-6" onClick={openAssistantWithMarketContext}>افتح مساعد AMIC <ArrowUpRight className="mr-2 size-4" /></Button></Panel></div>
    {!anyLoading && !anyData && !allFailed ? <div className="mt-6"><EmptyAction title="ابدأ بقراءة أصل محدد" description="يمكنك إدخال الرمز والبورصة والإطار الزمني للحصول على RSI وMACD وBollinger Bands من خدمة التحليل." href="/analysis" action="الانتقال إلى التحليل" /></div> : null}
  </>;
}

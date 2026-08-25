import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DataTable, EmptyAction, formatValue, MetricCard, PageHeading, Panel, SignalBadge } from "@/components/market-ui";
import { PreciousMetalsWidget } from "@/components/PreciousMetalsWidget";
import { SUGGESTED_SYMBOLS, SymbolSelect } from "@/components/SymbolSelect";
import { saveMarketAssistantContext } from "@/lib/marketAssistantContext";
import { trpc } from "@/lib/trpc";
import {
  DEFAULT_MARKET_PULSE_PREFERENCES,
  MARKET_PULSE_MARKETS,
  MARKET_PULSE_SECTIONS,
  type MarketPulsePreferences,
  type MarketPulseSectionKey,
  type MarketPulseWidgetKey,
} from "@shared/marketPulsePreferences";
import { Activity, ArrowUpRight, Bot, ChartNoAxesCombined, Clock3, Plus, RefreshCw, ScanSearch, Settings2, Trash2, TrendingDown, TrendingUp } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link, useLocation } from "wouter";

type PriceRow = { symbol?: string; price?: number; change_pct?: number; currency?: string; changePercent?: number; close?: number; indicators?: { close?: number; RSI?: number; volume?: number } };
type CorrelationMatrixData = { assets: { id: string; label: string }[]; matrix: { id: string; values: (number | null)[] }[]; fetchedAt: string };
type OverviewSlice = { kind: "slice"; items: unknown; fetchedAt: string; source: string; market: string; direction: "gainers" | "losers" };
type GlobalSnapshot = { kind: "snapshot"; data: unknown; fetchedAt: string; source: string };
type WatchlistQuote = { symbol: string; exchange: string; assetClass: string; price: number | null; changePercent: number | null; recommendation: string; source: string | null; fetchedAt: string | null; error: string | null };

function toMarketRows(value: unknown): PriceRow[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is PriceRow => item && typeof item === "object" && !Array.isArray(item));
}

function isOverviewSlice(value: unknown): value is OverviewSlice {
  return Boolean(value && typeof value === "object" && (value as { kind?: unknown }).kind === "slice");
}

function isGlobalSnapshot(value: unknown): value is GlobalSnapshot {
  return Boolean(value && typeof value === "object" && (value as { kind?: unknown }).kind === "snapshot");
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

function formatFetchedAt(value?: string | null) {
  if (!value) return "وقت الجلب غير متاح";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "وقت الجلب غير متاح";
  const minutes = Math.max(0, Math.round((Date.now() - date.getTime()) / 60_000));
  if (minutes < 1) return "تم الجلب الآن";
  if (minutes === 1) return "تم الجلب قبل دقيقة";
  return `تم الجلب قبل ${new Intl.NumberFormat("ar").format(minutes)} دقائق`;
}

const queryOpts = { refetchInterval: 300_000, refetchOnWindowFocus: false, staleTime: 280_000, retry: 1, retryDelay: 1500 } as const;

const PULSE_WIDGETS: Array<{ key: MarketPulseWidgetKey; title: string; description: string }> = [
  { key: "summary", title: "ملخص الأقسام المختارة", description: "بطاقات عدد النتائج للرابحين والخاسرين" },
  { key: "preciousMetals", title: "بطاقات الذهب والفضة", description: "سعر واتجاه المعادن الثمينة" },
  { key: "watchlist", title: "رموزي وأزواجي", description: "قائمة المتابعة الشخصية" },
  { key: "correlation", title: "مصفوفة الارتباط", description: "علاقات الأصول طويلة المدى" },
  { key: "globalSnapshot", title: "ملخص السياق الكلي", description: "المؤشرات والعملات والأصول العالمية" },
  { key: "assistantContext", title: "تحويل الأرقام إلى سياق", description: "إرسال ما اخترته إلى مساعد AMIC" },
];

function SlicePanel({
  title,
  subtitle,
  rows,
  negative,
  loading,
  error,
  source,
  fetchedAt,
  onRefresh,
  refreshing,
}: {
  title: string;
  subtitle: string;
  rows: PriceRow[];
  negative: boolean;
  loading: boolean;
  error: unknown;
  source?: string;
  fetchedAt?: string;
  onRefresh: () => void;
  refreshing: boolean;
}) {
  const base = rowsWithChange(rows)
    .filter(row => typeof row["التغير %"] === "number")
    .sort((a, b) => (a["التغير %"] as number) - (b["التغير %"] as number));
  const data = (negative ? base : base.slice().reverse()).slice(0, 6);
  return <Panel>
    <div className="mb-4 flex items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>
      <Button type="button" variant="ghost" size="icon" className="shrink-0" aria-label={`تحديث ${title}`} onClick={onRefresh} disabled={refreshing}>
        <RefreshCw className={`size-4 ${refreshing ? "animate-spin" : ""}`} />
      </Button>
    </div>
    {loading ? <div className="flex min-h-36 items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 text-sm text-muted-foreground"><Activity className="size-4 animate-spin" />جارٍ جلب النتائج…</div> : error ? <div className="flex min-h-36 flex-col items-center justify-center rounded-xl border border-rose-400/15 bg-rose-400/[0.035] px-4 text-center text-sm leading-6 text-rose-100">تعذّر جلب {title}.<Button type="button" variant="link" className="mt-1 h-auto px-0 text-rose-200" onClick={onRefresh}>إعادة المحاولة</Button></div> : <DataTable rows={data} emptyLabel="لا توجد نتائج متاحة من المزود الآن." />}
    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{source ? `${source} · ${formatFetchedAt(fetchedAt)}` : "بانتظار أول جلب للبيانات"}</p>
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
  return <Panel className="mt-6"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-primary">MARKET RELATIONSHIPS</p><h2 className="mt-2 text-xl font-semibold">مصفوفة ارتباط الأصول</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">ارتباط Pearson لعوائد الإغلاق اليومية خلال التاريخ المتاح؛ لا يعني علاقة سببية.</p></div>{loading ? <Activity className="size-5 animate-spin text-muted-foreground" /> : <ChartNoAxesCombined className="size-5 text-primary" />}</div>{error ? <p className="mt-5 text-sm text-muted-foreground">تعذّر حساب مصفوفة الارتباط الآن.</p> : data?.assets.length ? <div className="mt-5 overflow-x-auto" aria-label="اسحب أفقيًا لعرض مصفوفة الارتباط كاملة على الشاشات الصغيرة"><table className="min-w-[620px] w-full border-separate border-spacing-1 text-center text-xs"><thead><tr><th className="p-2 text-right text-muted-foreground">الأصل</th>{data.assets.map(asset => <th key={asset.id} className="p-2 font-medium text-muted-foreground">{asset.label}</th>)}</tr></thead><tbody>{data.matrix.map((row, index) => <tr key={row.id}><th className="p-2 text-right font-medium">{data.assets[index]?.label}</th>{row.values.map((value, valueIndex) => <td key={`${row.id}-${data.assets[valueIndex]?.id}`}><span className={`block rounded-md px-2 py-2 font-mono ${correlationClass(value)}`}>{value === null ? "—" : value.toFixed(2)}</span></td>)}</tr>)}</tbody></table></div> : <p className="mt-5 text-sm text-muted-foreground">{loading ? "جارٍ حساب الارتباطات…" : "لا توجد بيانات كافية لحساب الارتباطات الآن."}</p>}</Panel>;
}

export default function Home() {
  const [, navigate] = useLocation();
  const utils = trpc.useUtils();
  const [pulseDialogOpen, setPulseDialogOpen] = useState(false);
  const [draftPreferences, setDraftPreferences] = useState<MarketPulsePreferences>(DEFAULT_MARKET_PULSE_PREFERENCES);
  const [watchSymbol, setWatchSymbol] = useState("BTCUSDT");
  const [watchExchange, setWatchExchange] = useState("BINANCE");
  const preferencesQuery = trpc.market.pulse.getPreferences.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false });
  const preferences = preferencesQuery.data ? { sections: preferencesQuery.data.sections, widgets: preferencesQuery.data.widgets } : DEFAULT_MARKET_PULSE_PREFERENCES;
  const activeSections = preferences.sections;
  const activeWidgets = preferences.widgets;
  const savePreferences = trpc.market.pulse.savePreferences.useMutation({
    onSuccess: async () => {
      await utils.market.pulse.getPreferences.invalidate();
      setPulseDialogOpen(false);
      toast.success("تم حفظ تخصيص نبضة السوق لحسابك.");
    },
    onError: error => toast.error(error.message),
  });
  const addWatchSymbol = trpc.market.pulse.addSymbol.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.market.pulse.getPreferences.invalidate(), utils.market.pulse.watchlistQuotes.invalidate()]);
      toast.success("تمت إضافة الرمز إلى نبض السوق.");
    },
    onError: error => toast.error(error.message),
  });
  const removeWatchSymbol = trpc.market.pulse.removeSymbol.useMutation({
    onSuccess: async () => {
      await Promise.all([utils.market.pulse.getPreferences.invalidate(), utils.market.pulse.watchlistQuotes.invalidate()]);
      toast.success("تم حذف الرمز من نبض السوق.");
    },
    onError: error => toast.error(error.message),
  });
  const refreshOverviewSlice = trpc.market.refreshOverviewSlice.useMutation({
    onSuccess: (result, key) => utils.market.overviewSlice.setData(key, result),
    onError: error => toast.error(`تعذّر تحديث بيانات السوق: ${error.message}`),
  });
  const watchlistQuotesQuery = trpc.market.pulse.watchlistQuotes.useQuery(undefined, {
    enabled: activeWidgets.includes("watchlist") && Boolean(preferencesQuery.data?.watchlist.length),
    refetchInterval: 60_000,
    refetchOnWindowFocus: false,
    staleTime: 45_000,
    retry: 1,
  });

  const snapshotQuery = trpc.market.overviewSlice.useQuery("globalSnapshot", { ...queryOpts, enabled: activeWidgets.includes("globalSnapshot") });
  const correlationQuery = trpc.market.correlationMatrix.useQuery(undefined, { enabled: activeWidgets.includes("correlation"), staleTime: 55 * 60_000, refetchOnWindowFocus: false, retry: 1 });
  const cryptoGainersQuery = trpc.market.overviewSlice.useQuery("cryptoGainers", { ...queryOpts, enabled: activeSections.includes("cryptoGainers") });
  const cryptoLosersQuery = trpc.market.overviewSlice.useQuery("cryptoLosers", { ...queryOpts, enabled: activeSections.includes("cryptoLosers") });
  const stockGainersQuery = trpc.market.overviewSlice.useQuery("stockGainers", { ...queryOpts, enabled: activeSections.includes("stockGainers") });
  const stockLosersQuery = trpc.market.overviewSlice.useQuery("stockLosers", { ...queryOpts, enabled: activeSections.includes("stockLosers") });
  const sectionQueries = [
    { definition: MARKET_PULSE_SECTIONS[0], query: cryptoGainersQuery },
    { definition: MARKET_PULSE_SECTIONS[1], query: cryptoLosersQuery },
    { definition: MARKET_PULSE_SECTIONS[2], query: stockGainersQuery },
    { definition: MARKET_PULSE_SECTIONS[3], query: stockLosersQuery },
  ];
  const visibleSectionQueries = sectionQueries.filter(({ definition }) => activeSections.includes(definition.key));
  const snapshotResponse = isGlobalSnapshot(snapshotQuery.data) ? snapshotQuery.data : undefined;
  const snapshot = (snapshotResponse?.data ?? {}) as { indices?: PriceRow[]; crypto?: PriceRow[]; fx?: PriceRow[]; etfs?: PriceRow[] };
  const indices = snapshot.indices ?? [];
  const fx = snapshot.fx ?? [];
  const etfs = snapshot.etfs ?? [];
  const eurRate = fx.find(row => String(row.symbol ?? "").toUpperCase().startsWith("EUR"));
  const anyLoading = (activeWidgets.includes("globalSnapshot") && snapshotQuery.isLoading) || visibleSectionQueries.some(({ query }) => query.isLoading);
  const anyData = Boolean(indices.length || etfs.length || visibleSectionQueries.some(({ query }) => isOverviewSlice(query.data) && toMarketRows(query.data.items).length > 0));
  const allFailed = visibleSectionQueries.every(({ query }) => query.isError) && (!activeWidgets.includes("globalSnapshot") || snapshotQuery.isError);

  useEffect(() => {
    if (pulseDialogOpen && preferencesQuery.data) setDraftPreferences({ sections: [...preferences.sections], widgets: [...preferences.widgets] });
  }, [pulseDialogOpen, preferencesQuery.data, preferences.sections, preferences.widgets]);

  const visibleAssistantContext = useMemo(() => ({
    marketPulse: {
      preferences: { sections: [...activeSections], widgets: [...activeWidgets] },
      selectedSections: visibleSectionQueries.map(({ definition, query }) => {
        const response = isOverviewSlice(query.data) ? query.data : undefined;
        return {
          key: definition.key,
          title: definition.title,
          market: definition.market,
          exchange: definition.exchange,
          direction: definition.direction,
          source: response?.source ?? null,
          fetchedAt: response?.fetchedAt ?? null,
          results: response ? toMarketRows(response.items) : [],
        };
      }),
      watchlist: (watchlistQuotesQuery.data ?? []).map(item => ({
        symbol: item.symbol,
        exchange: item.exchange,
        price: item.price,
        changePercent: item.changePercent,
        recommendation: item.recommendation,
        source: item.source,
        fetchedAt: item.fetchedAt,
        unavailable: Boolean(item.error),
      })),
      globalSnapshot: activeWidgets.includes("globalSnapshot") ? { source: snapshotResponse?.source ?? null, fetchedAt: snapshotResponse?.fetchedAt ?? null, data: snapshotResponse?.data ?? {} } : undefined,
    },
  }), [activeSections, activeWidgets, snapshotResponse?.data, snapshotResponse?.fetchedAt, snapshotResponse?.source, visibleSectionQueries, watchlistQuotesQuery.data]);

  const toggleDraftSection = (key: MarketPulseSectionKey) => {
    setDraftPreferences(current => {
      const next = current.sections.includes(key) ? current.sections.filter(section => section !== key) : [...current.sections, key];
      return next.length ? { ...current, sections: next } : current;
    });
  };
  const toggleDraftMarket = (market: (typeof MARKET_PULSE_MARKETS)[number]["id"]) => {
    const marketSections = MARKET_PULSE_SECTIONS.filter(section => section.market === market).map(section => section.key);
    setDraftPreferences(current => {
      const selected = marketSections.every(section => current.sections.includes(section));
      const sections = selected ? current.sections.filter(section => !marketSections.includes(section)) : Array.from(new Set([...current.sections, ...marketSections]));
      return sections.length ? { ...current, sections } : current;
    });
  };
  const toggleDraftWidget = (key: MarketPulseWidgetKey) => setDraftPreferences(current => ({
    ...current,
    widgets: current.widgets.includes(key) ? current.widgets.filter(widget => widget !== key) : [...current.widgets, key],
  }));
  const refreshAllVisible = async () => {
    const keys: Array<MarketPulseSectionKey | "globalSnapshot"> = [
      ...activeSections,
      ...(activeWidgets.includes("globalSnapshot") ? ["globalSnapshot" as const] : []),
    ];
    await Promise.all(keys.map(key => refreshOverviewSlice.mutateAsync(key)));
  };
  const openAssistantWithMarketContext = () => {
    if (typeof window !== "undefined") {
      try {
        saveMarketAssistantContext(window.sessionStorage, visibleAssistantContext);
      } catch {
        toast.error("تعذّر حفظ سياق السوق مؤقتًا في هذا المتصفح.");
      }
    }
    navigate("/assistant");
  };

  return <>
    <PageHeading eyebrow="LIVE MARKET DESK" title="نبضة السوق" description="لوحة شخصية: اختر الأسواق واتجاه الحركة والوحدات التي تريد متابعتها، ثم حدّثها أو حوّل ما يظهر أمامك إلى سياق للمساعد." action={<div className="flex flex-wrap gap-2"><Dialog open={pulseDialogOpen} onOpenChange={setPulseDialogOpen}><DialogTrigger asChild><Button variant="outline" className="bg-white/[0.03]"><Settings2 className="ml-2 size-4" />تخصيص النبض</Button></DialogTrigger><DialogContent dir="rtl" className="max-h-[88dvh] overflow-y-auto border-white/[0.12] bg-[#09111b] text-foreground sm:max-w-2xl"><DialogHeader><DialogTitle>تخصيص نبض السوق</DialogTitle><DialogDescription>اختر الأسواق واتجاه الحركة والرؤى التي تريد إظهارها. تبقى كل هذه الإعدادات معزولة داخل حسابك.</DialogDescription></DialogHeader><div className="space-y-6"><section><Label className="text-sm">الأسواق واتجاه الحركة</Label><div className="mt-3 space-y-3">{MARKET_PULSE_MARKETS.map(market => { const marketSections = MARKET_PULSE_SECTIONS.filter(section => section.market === market.id); const selectedCount = marketSections.filter(section => draftPreferences.sections.includes(section.key)).length; const complete = selectedCount === marketSections.length; return <div key={market.id} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="flex items-start gap-3"><Checkbox id={`market-${market.id}`} checked={complete ? true : selectedCount ? "indeterminate" : false} onCheckedChange={() => toggleDraftMarket(market.id)} disabled={savePreferences.isPending} /><div className="min-w-0"><label htmlFor={`market-${market.id}`} className="cursor-pointer text-sm font-medium">{market.label}</label><p className="mt-1 text-xs text-muted-foreground">{market.description}</p></div></div><div className="mt-3 grid gap-2 border-t border-white/[0.06] pt-3 sm:grid-cols-2">{marketSections.map(section => { const checked = draftPreferences.sections.includes(section.key); const Icon = section.direction === "gainers" ? TrendingUp : TrendingDown; return <label key={section.key} className="flex cursor-pointer items-center gap-2 rounded-lg border border-white/[0.07] bg-black/10 px-3 py-2.5 text-sm"><Checkbox checked={checked} disabled={savePreferences.isPending || (checked && draftPreferences.sections.length === 1)} onCheckedChange={() => toggleDraftSection(section.key)} /><Icon className={`size-4 ${section.direction === "gainers" ? "text-emerald-300" : "text-rose-300"}`} /><span>{section.direction === "gainers" ? "الرابحون" : "الخاسرون"}</span></label>; })}</div></div>; })}</div><p className="mt-2 text-xs text-muted-foreground">تستطيع إظهار الرابحين فقط، أو الخاسرين فقط، أو كليهما لكل سوق متاح. يجب إبقاء قسم واحد ظاهرًا على الأقل.</p></section><section className="border-t border-white/[0.08] pt-5"><Label className="text-sm">الوحدات الظاهرة</Label><div className="mt-3 grid gap-2 sm:grid-cols-2">{PULSE_WIDGETS.map(widget => <label key={widget.key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.08] bg-white/[0.025] px-3 py-3 text-sm"><Checkbox checked={draftPreferences.widgets.includes(widget.key)} disabled={savePreferences.isPending} onCheckedChange={() => toggleDraftWidget(widget.key)} /><span><span className="block font-medium">{widget.title}</span><span className="mt-1 block text-xs text-muted-foreground">{widget.description}</span></span></label>)}</div></section><section className="border-t border-white/[0.08] pt-5"><div className="flex items-center justify-between gap-3"><Label className="text-sm">رموزي وأزواجي</Label><span className="font-mono text-xs text-muted-foreground">{preferencesQuery.data?.watchlist.length ?? 0}/8</span></div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_auto]"><SymbolSelect label="الرمز" className="sm:col-span-1" value={watchSymbol} onChange={setWatchSymbol} onSelect={symbol => { const entry = SUGGESTED_SYMBOLS.find(item => item.symbol === symbol); if (entry) setWatchExchange(entry.exchange); }} customLabel="رمز مخصص" /><div><Label>البورصة</Label><Input className="mt-2 bg-white/[0.025] font-mono" value={watchExchange} onChange={event => setWatchExchange(event.target.value.toUpperCase())} /></div><Button type="button" className="self-end" onClick={() => addWatchSymbol.mutate({ symbol: watchSymbol, exchange: watchExchange })} disabled={addWatchSymbol.isPending || (preferencesQuery.data?.watchlist.length ?? 0) >= 8}><Plus className="ml-1 size-4" />إضافة</Button></div><div className="mt-4 space-y-2">{preferencesQuery.data?.watchlist.length ? preferencesQuery.data.watchlist.map(item => <div key={`${item.exchange}:${item.symbol}`} className="flex items-center justify-between rounded-lg border border-white/[0.07] bg-black/15 px-3 py-2"><div><span className="font-mono text-sm">{item.symbol}</span><span className="mr-2 text-xs text-muted-foreground">{item.exchange}</span></div><Button type="button" size="icon" variant="ghost" aria-label={`حذف ${item.symbol}`} onClick={() => removeWatchSymbol.mutate({ symbol: item.symbol, exchange: item.exchange })} disabled={removeWatchSymbol.isPending}><Trash2 className="size-4 text-rose-300" /></Button></div>) : <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-4 text-center text-sm text-muted-foreground">لم تضف رموزًا شخصية بعد.</p>}</div></section><div className="flex flex-wrap justify-end gap-2 border-t border-white/[0.08] pt-5"><Button type="button" variant="outline" onClick={() => setDraftPreferences({ sections: [...DEFAULT_MARKET_PULSE_PREFERENCES.sections], widgets: [...DEFAULT_MARKET_PULSE_PREFERENCES.widgets] })} disabled={savePreferences.isPending}>استعادة الافتراضي</Button><Button type="button" onClick={() => savePreferences.mutate(draftPreferences)} disabled={savePreferences.isPending || draftPreferences.sections.length === 0}>{savePreferences.isPending ? <Activity className="ml-2 size-4 animate-spin" /> : <Settings2 className="ml-2 size-4" />}حفظ التخصيص</Button></div></div></DialogContent></Dialog><Button type="button" variant="outline" className="bg-white/[0.03]" onClick={() => void refreshAllVisible()} disabled={refreshOverviewSlice.isPending}><RefreshCw className={`ml-2 size-4 ${refreshOverviewSlice.isPending ? "animate-spin" : ""}`} />تحديث الظاهر</Button><Button asChild variant="outline" className="bg-white/[0.03]"><Link href="/screener">ماسح السوق <ScanSearch className="mr-2 size-4" /></Link></Button><Button asChild><Link href="/analysis">بدء تحليل <ArrowUpRight className="mr-2 size-4" /></Link></Button></div>} />
    {allFailed ? <div className="rounded-lg border border-rose-400/15 bg-rose-400/[0.035] px-6 py-10 text-center text-sm text-rose-100">تعذّر الوصول إلى مزود بيانات السوق للأقسام التي اخترتها. يمكنك استخدام زر «تحديث الظاهر» لإعادة المحاولة.</div> : null}
    {activeWidgets.includes("summary") ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">{visibleSectionQueries.map(({ definition, query }) => { const response = isOverviewSlice(query.data) ? query.data : undefined; const positive = definition.direction === "gainers"; return <MetricCard key={definition.key} label={definition.title} value={query.isLoading ? "…" : formatValue(toMarketRows(response?.items).length, 0)} detail={query.isError ? "تعذّر التحديث" : response ? `${response.market} · ${formatFetchedAt(response.fetchedAt)}` : "بانتظار البيانات"} positive={positive} icon={positive ? <TrendingUp className="size-4 text-emerald-300" /> : <TrendingDown className="size-4 text-rose-300" />} />; })}</div> : null}
    {activeWidgets.includes("preciousMetals") ? <div className="mt-6"><PreciousMetalsWidget /></div> : null}
    {activeWidgets.includes("watchlist") && preferencesQuery.data?.watchlist.length ? <Panel className="mt-6"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.12em] text-primary">MY MARKET PULSE</p><h2 className="mt-2 text-xl font-semibold">رموزك المختارة</h2><p className="mt-1 text-xs text-muted-foreground">لقطة شخصية؛ يفشل كل رمز بشكل مستقل حتى تبقى بقية القائمة متاحة.</p></div><Button type="button" variant="outline" size="sm" className="bg-white/[0.03]" onClick={() => setPulseDialogOpen(true)}><Settings2 className="ml-2 size-3.5" />تعديل</Button></div>{watchlistQuotesQuery.isLoading ? <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{preferencesQuery.data.watchlist.map(item => <div key={`${item.exchange}:${item.symbol}`} className="h-32 animate-pulse rounded-xl bg-white/[0.04]" />)}</div> : <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{(watchlistQuotesQuery.data as WatchlistQuote[] | undefined ?? []).map(item => <div key={`${item.exchange}:${item.symbol}`} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-mono font-semibold">{item.symbol}</p><p className="mt-1 text-xs text-muted-foreground">{item.exchange}</p></div><SignalBadge value={item.recommendation} /></div>{item.error ? <p className="mt-4 text-xs leading-5 text-rose-200">{item.error}</p> : <><p className="mt-4 font-mono text-lg">{item.price === null ? "—" : formatValue(item.price, 4)}</p><p className={`mt-1 text-xs ${typeof item.changePercent === "number" && item.changePercent < 0 ? "text-rose-300" : "text-emerald-300"}`}>{typeof item.changePercent === "number" ? `${item.changePercent >= 0 ? "+" : ""}${formatValue(item.changePercent, 2)}%` : "التغير غير متاح"}</p><p className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{item.source} · {formatFetchedAt(item.fetchedAt)}</p></>}</div>)}</div>}</Panel> : null}
    {activeWidgets.includes("correlation") ? <CorrelationMatrixPanel data={correlationQuery.data} loading={correlationQuery.isLoading} error={correlationQuery.error} /> : null}
    {anyLoading && !anyData ? <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Activity className="size-4 animate-spin" /> جارٍ جلب بيانات السوق…</div> : null}
    <div className="mt-6 grid gap-4 xl:grid-cols-2">{visibleSectionQueries.map(({ definition, query }) => { const response = isOverviewSlice(query.data) ? query.data : undefined; return <SlicePanel key={definition.key} title={definition.title} subtitle={definition.subtitle} negative={definition.direction === "losers"} loading={query.isLoading} error={query.error} source={response?.source} fetchedAt={response?.fetchedAt} onRefresh={() => refreshOverviewSlice.mutate(definition.key)} refreshing={refreshOverviewSlice.isPending && refreshOverviewSlice.variables === definition.key} rows={toMarketRows(response?.items)} />; })}</div>
    {(activeWidgets.includes("globalSnapshot") || activeWidgets.includes("assistantContext")) ? <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">{activeWidgets.includes("globalSnapshot") ? <Panel><div className="flex items-start justify-between"><div><p className="text-xs font-semibold tracking-[0.12em] text-primary">GLOBAL SNAPSHOT</p><h2 className="mt-2 text-xl font-semibold">ملخص السياق الكلي</h2><p className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground"><Clock3 className="size-3" />{snapshotResponse ? `${snapshotResponse.source} · ${formatFetchedAt(snapshotResponse.fetchedAt)}` : "بانتظار البيانات"}</p></div><Button type="button" variant="ghost" size="icon" aria-label="تحديث ملخص السياق الكلي" onClick={() => refreshOverviewSlice.mutate("globalSnapshot")} disabled={refreshOverviewSlice.isPending}><RefreshCw className={`size-4 ${refreshOverviewSlice.isPending && refreshOverviewSlice.variables === "globalSnapshot" ? "animate-spin" : ""}`} /></Button></div><div className="mt-5">{snapshotQuery.isLoading ? <div className="flex min-h-36 items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 text-sm text-muted-foreground"><Activity className="size-4 animate-spin" />جارٍ جلب ملخص السوق العالمي…</div> : snapshotQuery.isError ? <p className="rounded-xl border border-rose-400/15 bg-rose-400/[0.035] p-4 text-sm text-rose-100">تعذّر جلب الملخص العالمي الآن.</p> : <DataTable rows={[...rowsWithChange(indices), ...rowsWithChange(snapshot.crypto ?? []), ...rowsWithChange(fx).slice(0, 3), ...rowsWithChange(etfs)]} emptyLabel="لا توجد بيانات عالمية متاحة من المزود الآن." />}</div></Panel> : null}{activeWidgets.includes("assistantContext") ? <Panel className="flex flex-col justify-between"><div><Bot className="size-6 text-primary" /><h2 className="mt-5 text-xl font-semibold">حوّل ما اخترته إلى سياق</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">يرسل المساعد الأقسام والأسواق والرموز والوحدات الظاهرة حاليًا فقط، مع مصدر البيانات ووقت جلبها عندما يتوفران.</p></div><Button type="button" className="mt-6" onClick={openAssistantWithMarketContext}>افتح مساعد AMIC <ArrowUpRight className="mr-2 size-4" /></Button></Panel> : null}</div> : null}
    {!anyLoading && !anyData && !allFailed ? <div className="mt-6"><EmptyAction title="لا توجد نتائج من الأقسام التي اخترتها الآن" description="عدّل الأسواق أو الرابحين/الخاسرين من تخصيص النبض، أو أعد المحاولة بعد قليل." href="/analysis" action="الانتقال إلى التحليل" /></div> : null}
  </>;
}

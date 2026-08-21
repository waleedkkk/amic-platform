import { Button } from "@/components/ui/button";
import { DataTable, EmptyAction, formatValue, MetricCard, PageHeading, Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowDownRight, ArrowUpRight, BarChart3, Bot, ScanSearch, TrendingDown, TrendingUp } from "lucide-react";
import { Link } from "wouter";

type PriceRow = { symbol?: string; price?: number; change_pct?: number; currency?: string; changePercent?: number; close?: number; indicators?: { close?: number; RSI?: number; volume?: number } };

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

const queryOpts = { refetchInterval: 300_000, refetchOnWindowFocus: false, staleTime: 240_000, retry: 2 } as const;

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

export default function Home() {
  const slices = [
    { key: "cryptoGainers", title: "أبرز الرابحين — كريبتو", subtitle: "نسبة التغير وفق الإطار اليومي", negative: false, icon: <TrendingUp className="size-5 text-emerald-300" /> },
    { key: "cryptoLosers", title: "أبرز الخاسرين — كريبتو", subtitle: "تحركات تحتاج إلى قراءة حجم وتذبذب", negative: true, icon: <TrendingDown className="size-5 text-rose-300" /> },
    { key: "stockGainers", title: "أبرز الرابحين — أسهم", subtitle: "نتائج الفحص على NASDAQ", negative: false, icon: <TrendingUp className="size-5 text-emerald-300" /> },
    { key: "stockLosers", title: "أبرز الخاسرين — أسهم", subtitle: "نتائج الفحص على NASDAQ", negative: true, icon: <TrendingDown className="size-5 text-rose-300" /> },
  ] as const;

  const snapshotQuery = trpc.market.overviewSlice.useQuery("globalSnapshot", { ...queryOpts, enabled: true });
  const queries = slices.map(s => ({ ...s, query: trpc.market.overviewSlice.useQuery(s.key, { ...queryOpts, enabled: true }) }));

  const snapshot = (snapshotQuery.data ?? {}) as { indices?: PriceRow[]; crypto?: PriceRow[]; fx?: PriceRow[]; etfs?: PriceRow[] };
  const indices = snapshot.indices ?? [];
  const fx = snapshot.fx ?? [];
  const etfs = snapshot.etfs ?? [];
  const eurRate = fx.find(row => String(row.symbol ?? "").toUpperCase().startsWith("EUR"));

  const anyLoading = snapshotQuery.isLoading || queries.some(q => q.query.isLoading);
  const anyData = Boolean(indices.length || etfs.length || queries.some(q => q.query.data && toMarketRows(q.query.data).length > 0));
  const allFailed = queries.every(q => q.query.isError) && snapshotQuery.isError;

  return <>
    <PageHeading eyebrow="LIVE MARKET DESK" title="نبضة السوق" description="نظرة عملية على الحركة النسبية عبر الكريبتو والأسهم وأسواق العملات، مع تحديث تلقائي للبيانات المتاحة." action={<div className="flex gap-2"><Button asChild variant="outline" className="bg-white/[0.03]"><Link href="/screener">ماسح السوق <ScanSearch className="mr-2 size-4" /></Link></Button><Button asChild><Link href="/analysis">بدء تحليل <ArrowUpRight className="mr-2 size-4" /></Link></Button></div>} />
    {allFailed ? <div className="rounded-lg border border-white/10 bg-white/[0.03] px-6 py-10 text-center text-sm text-muted-foreground">تعذّر الوصول إلى مزود بيانات السوق حاليًا — تحقق من اتصالك ثم أعد تحميل الصفحة.</div> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="رابحو الكريبتو" value={formatValue(toMarketRows(queries[0].query.data).length, 0)} detail="نتائج متاحة على BINANCE" positive icon={<TrendingUp className="size-4 text-emerald-300" />} /><MetricCard label="خاسرو الكريبتو" value={formatValue(toMarketRows(queries[1].query.data).length, 0)} detail="نتائج متاحة على BINANCE" positive={false} icon={<TrendingDown className="size-4 text-rose-300" />} /><MetricCard label="حركة المؤشرات" value={formatValue(indices.length, 0)} detail="مؤشرات عالمية نشطة" icon={<BarChart3 className="size-4 text-sky-300" />} /><MetricCard label="لقطة العملات" value={eurRate?.price ? formatValue(eurRate.price, 4) : "—"} detail={eurRate?.price ? `EUR/USD من ملخص السوق العالمي` : "من ملخص السوق العالمي"} icon={<Activity className="size-4 text-amber-300" />} /></div>}
    {anyLoading && !anyData ? <div className="mt-6 flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"><Activity className="size-4 animate-spin" /> جارٍ جلب بيانات السوق…</div> : null}
    <div className="mt-6 grid gap-4 xl:grid-cols-2">
      {queries.map(({ key, title, subtitle, negative, icon, query }) => (
        <SlicePanel key={key} title={title} subtitle={subtitle} negative={negative} loading={query.isLoading} error={query.error} icon={icon} rows={toMarketRows(query.data)} />
      ))}
    </div>
    <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]"><Panel><div className="flex items-start justify-between"><div><p className="text-xs font-semibold tracking-[0.12em] text-primary">GLOBAL SNAPSHOT</p><h2 className="mt-2 text-xl font-semibold">ملخص السياق الكلي</h2></div>{snapshotQuery.isLoading ? <span className="animate-spin"><Activity className="size-5 text-muted-foreground" /></span> : <Activity className="size-5 text-primary" />}</div><div className="mt-5"><DataTable rows={[...rowsWithChange(indices), ...rowsWithChange(snapshot.crypto ?? []), ...rowsWithChange(fx).slice(0, 3), ...rowsWithChange(etfs)]} emptyLabel={snapshotQuery.isLoading ? "جارٍ جلب ملخص السوق العالمي…" : "تظهر المؤشرات العالمية عند استجابة مزود البيانات."} /></div></Panel><Panel className="flex flex-col justify-between"><div><Bot className="size-6 text-primary" /><h2 className="mt-5 text-xl font-semibold">حوّل الأرقام إلى سياق</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">استخدم المساعد لتفسير مؤشراتك وأسئلتك مع تنبيه واضح بأن المخرجات معلوماتية وليست نصيحة استثمارية.</p></div><Button asChild className="mt-6"><Link href="/assistant">افتح مساعد AMIC <ArrowUpRight className="mr-2 size-4" /></Link></Button></Panel></div>
    {!anyLoading && !anyData && !allFailed ? <div className="mt-6"><EmptyAction title="ابدأ بقراءة أصل محدد" description="يمكنك إدخال الرمز والبورصة والإطار الزمني للحصول على RSI وMACD وBollinger Bands من خدمة التحليل." href="/analysis" action="الانتقال إلى التحليل" /></div> : null}
  </>;
}

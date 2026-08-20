import { Button } from "@/components/ui/button";
import { DataTable, EmptyAction, formatValue, LoadState, MetricCard, PageHeading, Panel } from "@/components/market-ui";
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

function MarketSlice({ title, subtitle, rows, negative }: { title: string; subtitle: string; rows: PriceRow[]; negative?: boolean }) {
  const base = rowsWithChange(rows)
    .filter(row => typeof row["التغير %"] === "number")
    .sort((a, b) => (a["التغير %"] as number) - (b["التغير %"] as number));
  const data = (negative ? base : base.slice().reverse()).slice(0, 6);
  return <Panel><div className="mb-4 flex items-start justify-between"><div><h2 className="font-semibold">{title}</h2><p className="mt-1 text-xs text-muted-foreground">{subtitle}</p></div>{negative ? <TrendingDown className="size-5 text-rose-300" /> : <TrendingUp className="size-5 text-emerald-300" />}</div><DataTable rows={data} emptyLabel="لا توجد نتائج من المزود الآن." /></Panel>;
}

export default function Home() {
  const overview = trpc.market.overview.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: false });
  const data = (overview.data ?? {}) as {
    globalSnapshot?: { indices?: PriceRow[]; crypto?: PriceRow[]; fx?: PriceRow[]; etfs?: PriceRow[] };
    cryptoGainers?: unknown;
    cryptoLosers?: unknown;
    stockGainers?: unknown;
    stockLosers?: unknown;
  };
  const snapshot = data.globalSnapshot ?? {};
  const indices = snapshot.indices ?? [];
  const crypto = snapshot.crypto ?? [];
  const fx = snapshot.fx ?? [];
  const etfs = snapshot.etfs ?? [];
  const cryptoGainers = toMarketRows((data as { cryptoGainers?: unknown }).cryptoGainers);
  const cryptoLosers = toMarketRows((data as { cryptoLosers?: unknown }).cryptoLosers);
  const stockGainers = toMarketRows((data as { stockGainers?: unknown }).stockGainers);
  const stockLosers = toMarketRows((data as { stockLosers?: unknown }).stockLosers);
  const eurRate = fx.find(row => String(row.symbol ?? "").toUpperCase().startsWith("EUR"));
  return <>
    <PageHeading eyebrow="LIVE MARKET DESK" title="نبضة السوق" description="نظرة عملية على الحركة النسبية عبر الكريبتو والأسهم وأسواق العملات، مع تحديث تلقائي للبيانات المتاحة." action={<div className="flex gap-2"><Button asChild variant="outline" className="bg-white/[0.03]"><Link href="/screener">ماسح السوق <ScanSearch className="mr-2 size-4" /></Link></Button><Button asChild><Link href="/analysis">بدء تحليل <ArrowUpRight className="mr-2 size-4" /></Link></Button></div>} />
    <LoadState loading={overview.isLoading} error={overview.error}><div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard label="رابحو الكريبتو" value={formatValue(cryptoGainers.length, 0)} detail="نتائج متاحة على BINANCE" positive icon={<TrendingUp className="size-4 text-emerald-300" />} /><MetricCard label="خاسرو الكريبتو" value={formatValue(cryptoLosers.length, 0)} detail="نتائج متاحة على BINANCE" positive={false} icon={<TrendingDown className="size-4 text-rose-300" />} /><MetricCard label="حركة المؤشرات" value={formatValue(indices.length, 0)} detail="مؤشرات عالمية نشطة" icon={<BarChart3 className="size-4 text-sky-300" />} /><MetricCard label="لقطة العملات" value={eurRate?.price ? formatValue(eurRate.price, 4) : "—"} detail={eurRate?.price ? `EUR/USD من ملخص السوق العالمي` : "من ملخص السوق العالمي"} icon={<Activity className="size-4 text-amber-300" />} /></div>
      <div className="mt-6 grid gap-4 xl:grid-cols-2"><MarketSlice title="أبرز الرابحين — كريبتو" subtitle="نسبة التغير وفق الإطار اليومي" rows={cryptoGainers} /><MarketSlice title="أبرز الخاسرين — كريبتو" subtitle="تحركات تحتاج إلى قراءة حجم وتذبذب" rows={cryptoLosers} negative /><MarketSlice title="أبرز الرابحين — أسهم" subtitle="نتائج الفحص على NASDAQ" rows={stockGainers} /><MarketSlice title="أبرز الخاسرين — أسهم" subtitle="نتائج الفحص على NASDAQ" rows={stockLosers} negative /></div>
      <div className="mt-6 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]"><Panel><div className="flex items-start justify-between"><div><p className="text-xs font-semibold tracking-[0.12em] text-primary">GLOBAL SNAPSHOT</p><h2 className="mt-2 text-xl font-semibold">ملخص السياق الكلي</h2></div><Activity className="size-5 text-primary" /></div><div className="mt-5"><DataTable rows={[...rowsWithChange(indices), ...rowsWithChange(crypto), ...rowsWithChange(fx).slice(0, 3), ...rowsWithChange(etfs)]} emptyLabel="تظهر المؤشرات العالمية عند استجابة مزود البيانات." /></div></Panel><Panel className="flex flex-col justify-between"><div><Bot className="size-6 text-primary" /><h2 className="mt-5 text-xl font-semibold">حوّل الأرقام إلى سياق</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">استخدم المساعد لتفسير مؤشراتك وأسئلتك مع تنبيه واضح بأن المخرجات معلوماتية وليست نصيحة استثمارية.</p></div><Button asChild className="mt-6"><Link href="/assistant">افتح مساعد AMIC <ArrowUpRight className="mr-2 size-4" /></Link></Button></Panel></div>
      {!cryptoGainers.length && !stockGainers.length && !indices.length && !overview.isLoading ? <div className="mt-6"><EmptyAction title="ابدأ بقراءة أصل محدد" description="يمكنك إدخال الرمز والبورصة والإطار الزمني للحصول على RSI وMACD وBollinger Bands من خدمة التحليل." href="/analysis" action="الانتقال إلى التحليل" /></div> : null}
    </LoadState>
  </>;
}

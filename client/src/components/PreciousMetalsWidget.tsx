import { Button } from "@/components/ui/button";
import { Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { Activity, ArrowDownRight, ArrowUpRight, Gem, RefreshCw } from "lucide-react";
import { Link } from "wouter";

type MetalQuote = {
  symbol: string;
  label: string;
  shortLabel: string;
  price: number;
  changePercent: number | null;
  currency: string;
  precision: number;
};

function priceLabel(item: MetalQuote) {
  return new Intl.NumberFormat("ar", {
    minimumFractionDigits: item.precision,
    maximumFractionDigits: item.precision,
  }).format(item.price);
}

export function PreciousMetalsWidget() {
  const query = trpc.market.preciousMetals.useQuery(undefined, {
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
    staleTime: 55_000,
    retry: 1,
  });
  const data = query.data as { items?: MetalQuote[]; fetchedAt?: string } | undefined;
  const fetchedAt = data?.fetchedAt
    ? new Date(data.fetchedAt).toLocaleTimeString("ar", { hour: "2-digit", minute: "2-digit" })
    : null;

  return <Panel className="relative overflow-hidden border-amber-300/15 bg-gradient-to-br from-amber-300/[0.09] via-card to-card p-4 sm:p-5">
    <div className="pointer-events-none absolute -left-9 -top-9 size-28 rounded-full bg-amber-300/[0.08] blur-2xl" />
    <div className="relative flex items-start justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><Gem className="size-5" /></span>
        <div>
          <p className="text-[11px] font-semibold tracking-[0.12em] text-amber-200/80">PRECIOUS METALS</p>
          <h2 className="mt-0.5 text-base font-semibold">مراقبة المعادن الثمينة</h2>
          <p className="mt-1 text-xs text-muted-foreground">عقود الذهب والفضة بالدولار لكل أوقية، وتحديث تلقائي كل دقيقة.</p>
        </div>
      </div>
      <Button size="icon" variant="ghost" className="shrink-0 text-muted-foreground hover:text-foreground" onClick={() => query.refetch()} disabled={query.isFetching} aria-label="تحديث أسعار المعادن">
        <RefreshCw className={`size-4 ${query.isFetching ? "animate-spin" : ""}`} />
      </Button>
    </div>

    {query.isLoading ? <div className="mt-5 grid grid-cols-2 gap-3" aria-label="جارٍ تحميل أسعار المعادن">
      {[0, 1].map(index => <div key={index} className="h-28 animate-pulse rounded-xl border border-white/[0.07] bg-white/[0.035]" />)}
    </div> : query.isError || !data?.items?.length ? <div className="mt-5 rounded-xl border border-amber-300/15 bg-black/10 px-4 py-4 text-sm text-muted-foreground">تعذّر جلب أسعار المعادن الآن. استخدم زر التحديث للمحاولة مرة أخرى.</div> : <>
      <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-live="polite">
        {data.items.map(item => {
          const isPositive = typeof item.changePercent === "number" && item.changePercent >= 0;
          return <Link key={item.symbol} href="/analysis" className="group rounded-xl border border-white/[0.08] bg-black/10 p-3.5 transition-colors hover:border-amber-300/25 hover:bg-amber-300/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
            <div className="flex items-start justify-between gap-3">
              <div><p className="font-medium">{item.label}</p><p className="mt-0.5 text-[11px] tracking-wide text-muted-foreground">{item.symbol} · {item.shortLabel}</p></div>
              {typeof item.changePercent === "number" ? <span className={`inline-flex items-center gap-0.5 rounded-md px-1.5 py-1 text-xs font-medium ${isPositive ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300"}`}>{isPositive ? <ArrowUpRight className="size-3.5" /> : <ArrowDownRight className="size-3.5" />}{Math.abs(item.changePercent).toLocaleString("ar", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</span> : <span className="text-xs text-muted-foreground">—</span>}
            </div>
            <div className="mt-4 flex items-end justify-between gap-2"><p className="text-xl font-semibold tracking-tight sm:text-2xl">{priceLabel(item)}</p><p className="pb-0.5 text-xs text-muted-foreground">{item.currency} / أوقية</p></div>
          </Link>;
        })}
      </div>
      <div className="mt-4 flex items-center justify-between gap-3 text-[11px] text-muted-foreground"><span className="inline-flex items-center gap-1"><Activity className="size-3.5 text-primary" />{fetchedAt ? `آخر تحديث ${fetchedAt}` : "بيانات السوق"}</span><Link href="/analysis" className="font-medium text-primary hover:underline">فتح التحليل</Link></div>
    </>}
  </Panel>;
}

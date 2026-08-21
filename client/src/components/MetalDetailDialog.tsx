import { CandlestickChart } from "@/components/CandlestickChart";
import { MetalAlertSettings } from "@/components/MetalAlertSettings";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ArrowDownRight, ArrowUpRight, CandlestickChart as CandleIcon, Gem } from "lucide-react";

export type MetalDetail = {
  symbol: string;
  label: string;
  shortLabel: string;
  price: number;
  changePercent: number | null;
  currency: string;
  precision: number;
};

function formatPrice(item: MetalDetail) {
  return new Intl.NumberFormat("ar", {
    minimumFractionDigits: item.precision,
    maximumFractionDigits: item.precision,
  }).format(item.price);
}

export function MetalDetailDialog({ item, open, onOpenChange }: {
  item: MetalDetail | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  if (!item) return null;
  const isPositive = typeof item.changePercent === "number" && item.changePercent >= 0;

  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="max-h-[92dvh] max-w-5xl overflow-y-auto border-amber-300/20 bg-[#080d15] p-0 sm:rounded-2xl">
      <DialogHeader className="border-b border-white/[0.08] bg-gradient-to-l from-amber-300/[0.10] to-transparent px-5 py-5 sm:px-7">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl border border-amber-300/20 bg-amber-300/10 text-amber-200"><Gem className="size-5" /></span>
          <div className="min-w-0">
            <DialogTitle className="flex flex-wrap items-center gap-2 text-right text-xl">التحليل الفني — {item.label}<span className="font-mono text-sm font-normal text-muted-foreground">{item.symbol}</span></DialogTitle>
            <DialogDescription className="mt-1 text-right">عقد {item.shortLabel} بالدولار لكل أوقية، مع مؤشرات المتوسطات والدعم والمقاومة والحجم.</DialogDescription>
          </div>
        </div>
      </DialogHeader>
      <div className="space-y-5 px-5 py-5 sm:px-7 sm:py-6">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">السعر الحالي</p><p className="mt-2 text-2xl font-semibold tracking-tight">{formatPrice(item)}</p><p className="mt-1 text-xs text-muted-foreground">{item.currency} / أوقية</p></div>
          <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">التغير اليومي</p>{typeof item.changePercent === "number" ? <p className={`mt-2 inline-flex items-center gap-1 text-2xl font-semibold ${isPositive ? "text-emerald-300" : "text-rose-300"}`}>{isPositive ? <ArrowUpRight className="size-5" /> : <ArrowDownRight className="size-5" />}{Math.abs(item.changePercent).toLocaleString("ar", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</p> : <p className="mt-2 text-2xl font-semibold text-muted-foreground">—</p>}<p className="mt-1 text-xs text-muted-foreground">مقارنة بإغلاق سابق</p></div>
          <div className="rounded-xl border border-primary/15 bg-primary/[0.05] p-4"><CandleIcon className="size-5 text-primary" /><p className="mt-2 text-sm font-medium">قراءة قابلة للتخصيص</p><p className="mt-1 text-xs leading-5 text-muted-foreground">بدّل الإطار وطبقات البيانات من أدوات المخطط أدناه.</p></div>
        </div>
        <CandlestickChart symbol={item.symbol === "XAUUSD" ? "GC=F" : "SI=F"} exchange="OZ" />
        <MetalAlertSettings metal={item.symbol as "XAUUSD" | "XAGUSD"} label={item.label} currentPrice={item.price} precision={item.precision} />
      </div>
    </DialogContent>
  </Dialog>;
}

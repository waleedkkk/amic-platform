import { formatValue, Panel } from "@/components/market-ui";
import type { CorrelationContext, CorrelationContextItem } from "@shared/correlationContext";
import { ArrowDownRight, ArrowUpRight, CircleMinus, Link2, ShieldAlert } from "lucide-react";

function statusCopy(item: CorrelationContextItem) {
  if (item.status === "aligned") return { label: "متوافق", className: "border-emerald-400/25 bg-emerald-400/[0.08] text-emerald-200" };
  if (item.status === "divergent") return { label: "متعارض", className: "border-rose-400/25 bg-rose-400/[0.08] text-rose-200" };
  if (item.status === "context_only") return { label: "سياقي", className: "border-sky-400/25 bg-sky-400/[0.08] text-sky-200" };
  return { label: "غير حاسم", className: "border-white/[0.12] bg-white/[0.04] text-muted-foreground" };
}

function directionIcon(item: CorrelationContextItem) {
  if (item.direction === "up") return <ArrowUpRight className="size-3.5 text-emerald-300" aria-label="صاعد" />;
  if (item.direction === "down") return <ArrowDownRight className="size-3.5 text-rose-300" aria-label="هابط" />;
  return <CircleMinus className="size-3.5 text-muted-foreground" aria-label="محايد أو غير متاح" />;
}

const assessmentLabels = {
  strong: "توافق قوي",
  moderate: "توافق متوسط",
  weak: "توافق ضعيف",
  conflicted: "تعارض سياقي",
  insufficient: "بيانات غير كافية",
} as const;

export function CorrelationContextPanel({ context }: { context?: CorrelationContext }) {
  if (!context) {
    return <Panel className="mt-6 border border-white/[0.08] bg-white/[0.015] p-4"><div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-white/[0.05] text-muted-foreground"><Link2 className="size-4" /></div><div><p className="text-xs font-semibold tracking-[0.13em] text-primary">CORRELATION CONTEXT</p><h2 className="mt-2 font-semibold">السياق المترابط</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">لم تتوفر قيم آنية كافية للأصول المرتبطة لهذه القراءة. لا يؤثر ذلك في التحليل الفني الأساسي للرمز.</p></div></div></Panel>;
  }

  return <Panel className="mt-6 overflow-hidden border border-sky-400/15 bg-gradient-to-br from-sky-400/[0.075] via-transparent to-violet-400/[0.04] p-4 sm:p-5">
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="flex min-w-0 items-start gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/10 text-sky-200"><Link2 className="size-5" /></div><div><p className="text-xs font-semibold tracking-[0.13em] text-sky-200">CORRELATION CONTEXT</p><h2 className="mt-1 text-lg font-semibold">السياق المترابط</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">قراءة تفسيرية لأصول ذات علاقة اقتصادية أو هيكلية، منفصلة عن التحليل الأساسي وليست توصية تداول.</p></div></div>
      <div className="shrink-0 rounded-lg border border-white/[0.09] bg-black/10 px-3 py-2 text-right"><p className="text-xs text-muted-foreground">الحالة النسبية</p><p className="mt-1 text-sm font-semibold text-sky-100">{assessmentLabels[context.assessment]}</p></div>
    </div>

    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {context.items.map(item => {
        const status = statusCopy(item);
        return <div key={item.id} className="rounded-xl border border-white/[0.08] bg-black/10 p-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{item.label}</p><p className="mt-1 truncate text-[11px] text-muted-foreground">{item.symbol} · {item.exchange}</p></div><span className={`shrink-0 rounded-md border px-1.5 py-0.5 text-[10px] font-medium ${status.className}`}>{status.label}</span></div><div className="mt-3 flex items-end justify-between gap-2"><div><p className="font-mono text-sm text-foreground">{formatValue(item.price, item.price !== null && item.price < 1 ? 6 : 2)}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">{directionIcon(item)}{item.changePercent === null ? "لا يتوفر التغير" : `${item.changePercent >= 0 ? "+" : ""}${formatValue(item.changePercent, 2)}%`}</p></div></div><p className="mt-3 border-t border-white/[0.06] pt-2 text-[11px] leading-5 text-muted-foreground">{item.rationale}</p></div>;
      })}
    </div>

    <div className="mt-4 rounded-xl border border-sky-400/15 bg-sky-400/[0.06] p-3.5"><div className="flex items-start gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0 text-sky-200" /><div><p className="text-sm font-semibold text-sky-100">خلاصة السياق: {assessmentLabels[context.assessment]}</p><p className="mt-1 text-sm leading-6 text-sky-50/85">{context.summary}</p></div></div></div>
    <p className="mt-3 text-[11px] text-muted-foreground">المصدر: TradingView MCP · فئة الأصل: {context.assetClass} · وقت الجلب: {new Date(context.fetchedAt).toLocaleTimeString("ar-EG")}</p>
  </Panel>;
}

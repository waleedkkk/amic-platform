import React from "react";
import { CheckCircle2, Circle, CircleHelp, LoaderCircle, MousePointerClick } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type PaperTradeCloseProgressStage = "checking" | "awaiting_confirmation" | "closing";

const stages = [
  {
    id: "checking",
    title: "فحص السعر المرجعي",
    detail: "يتحقق الخادم من السعر والانحراف.",
    tooltip: "يجلب الخادم سعرًا مرجعيًا حديثًا ويقارن به سعر الإغلاق الذي أدخلته. لا تُغلق الصفقة في هذه المرحلة.",
  },
  {
    id: "awaiting_confirmation",
    title: "مراجعة التأكيد",
    detail: "تأكيدك مطلوب فقط عند وجود انحراف كبير.",
    tooltip: "تظهر هذه المرحلة فقط إذا تجاوز الفرق بين سعر الإغلاق والسعر المرجعي الحد الآمن. راجع السعر ثم أكّد الإغلاق أو عدّله.",
  },
  {
    id: "closing",
    title: "تسجيل الإغلاق",
    detail: "يُحسب الربح أو الخسارة وتُحدّث الصفقة.",
    tooltip: "بعد التأكيد، يحسب الخادم الربح أو الخسارة ويسجل سعر الإغلاق والوقت وبيانات الانحراف إن وُجدت.",
  },
] as const;

const progressByStage: Record<PaperTradeCloseProgressStage, number> = {
  checking: 34,
  awaiting_confirmation: 67,
  closing: 92,
};

function stageIndex(stage: PaperTradeCloseProgressStage) {
  return stages.findIndex(item => item.id === stage);
}

function StageTooltip({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent dir="rtl" side="top" sideOffset={10} className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-sky-200/20 bg-slate-950/95 p-0 text-right text-slate-100 shadow-2xl backdrop-blur-md"><div className="border-b border-sky-100/10 bg-sky-400/[0.08] px-3 py-2"><div className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-lg bg-sky-400/15 text-sky-100"><CircleHelp className="size-3.5" /></span><p className="text-xs font-semibold text-sky-100">{title}</p></div></div><div className="px-3 py-2.5"><p className="text-xs leading-5 text-slate-100/90">{text}</p><p className="mt-2 flex items-start gap-1.5 border-t border-white/[0.08] pt-2 text-[10px] leading-4 text-slate-400"><MousePointerClick className="mt-0.5 size-3 shrink-0 text-sky-300" />مرّر المؤشر أو انتقل بالمفاتيح أو اضغط لعرض الشرح.</p></div></TooltipContent></Tooltip>;
}

export function PaperTradeCloseProgress({
  stage,
  compact = false,
  className,
}: {
  stage: PaperTradeCloseProgressStage;
  compact?: boolean;
  className?: string;
}) {
  const activeIndex = stageIndex(stage);
  const activeStage = stages[activeIndex];

  return (
    <section
      aria-label="تقدم إغلاق الصفقة الورقية"
      aria-live="polite"
      className={cn("rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3 transition-[border-color,background-color,box-shadow] duration-300 motion-reduce:transition-none", className)}
    >
      <div key={stage} className="flex items-start justify-between gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sky-100">{activeStage.title}</p>
          <p className="mt-1 text-xs leading-5 text-sky-100/75">{activeStage.detail}</p>
        </div>
        <span key={`${stage}-percent`} className="shrink-0 font-mono text-xs text-sky-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200">{progressByStage[stage]}%</span>
      </div>

      <Progress value={progressByStage[stage]} className="mt-3 h-1.5 bg-sky-400/15 [&_[data-slot=progress-indicator]]:bg-sky-300 [&_[data-slot=progress-indicator]]:duration-500 [&_[data-slot=progress-indicator]]:ease-out motion-reduce:[&_[data-slot=progress-indicator]]:transition-none" />

      <ol className={cn("mt-3 grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
        {stages.map((item, index) => {
          const isCurrent = index === activeIndex;
          const isComplete = index < activeIndex;

          return (
            <li key={item.id} className="min-w-0">
              <StageTooltip title={`شرح مرحلة: ${item.title}`} text={item.tooltip}>
                <button type="button" aria-label={`شرح مرحلة ${item.title}`} aria-current={isCurrent ? "step" : undefined} className={cn("flex w-full items-center gap-1.5 rounded-md px-1 py-1 text-right text-[11px] leading-4 transition-[transform,colors,background-color,opacity] duration-200 hover:scale-[1.02] hover:bg-sky-400/[0.08] active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-300 motion-reduce:transition-none", isCurrent ? "bg-sky-400/[0.08] text-sky-100" : isComplete ? "text-emerald-200" : "text-muted-foreground")}>
                  <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full transition-[transform,background-color] duration-200 motion-reduce:transition-none", isCurrent && "bg-sky-300/15 motion-safe:animate-pulse", isComplete && "bg-emerald-300/10")}>
                    {isCurrent ? <LoaderCircle className="size-3 motion-safe:animate-spin" aria-hidden="true" /> : isComplete ? <CheckCircle2 className="size-3" aria-hidden="true" /> : <Circle className="size-3" aria-hidden="true" />}
                  </span>
                  <span className="truncate">{item.title}</span>
                  <CircleHelp className="mr-auto size-3 shrink-0 opacity-60" aria-hidden="true" />
                </button>
              </StageTooltip>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

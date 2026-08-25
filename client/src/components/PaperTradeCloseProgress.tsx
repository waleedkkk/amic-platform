import React from "react";
import { CheckCircle2, Circle, LoaderCircle } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

export type PaperTradeCloseProgressStage = "checking" | "awaiting_confirmation" | "closing";

const stages = [
  { id: "checking", title: "فحص السعر المرجعي", detail: "يتحقق الخادم من السعر والانحراف." },
  { id: "awaiting_confirmation", title: "مراجعة التأكيد", detail: "تأكيدك مطلوب فقط عند وجود انحراف كبير." },
  { id: "closing", title: "تسجيل الإغلاق", detail: "يُحسب الربح أو الخسارة وتُحدّث الصفقة." },
] as const;

const progressByStage: Record<PaperTradeCloseProgressStage, number> = {
  checking: 34,
  awaiting_confirmation: 67,
  closing: 92,
};

function stageIndex(stage: PaperTradeCloseProgressStage) {
  return stages.findIndex(item => item.id === stage);
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
      className={cn("rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3", className)}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-sky-100">{activeStage.title}</p>
          <p className="mt-1 text-xs leading-5 text-sky-100/75">{activeStage.detail}</p>
        </div>
        <span className="shrink-0 font-mono text-xs text-sky-200">{progressByStage[stage]}%</span>
      </div>

      <Progress value={progressByStage[stage]} className="mt-3 h-1.5 bg-sky-400/15 [&_[data-slot=progress-indicator]]:bg-sky-300" />

      <ol className={cn("mt-3 grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
        {stages.map((item, index) => {
          const isCurrent = index === activeIndex;
          const isComplete = index < activeIndex;

          return (
            <li key={item.id} className="min-w-0">
              <div className={cn("flex items-center gap-1.5 text-[11px] leading-4", isCurrent ? "text-sky-100" : isComplete ? "text-emerald-200" : "text-muted-foreground")}>
                {isCurrent ? <LoaderCircle className="size-3 shrink-0 animate-spin" aria-hidden="true" /> : isComplete ? <CheckCircle2 className="size-3 shrink-0" aria-hidden="true" /> : <Circle className="size-3 shrink-0" aria-hidden="true" />}
                <span className="truncate">{item.title}</span>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

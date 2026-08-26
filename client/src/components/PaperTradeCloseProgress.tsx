import React from "react";
import { Check, CheckCircle2, Circle, CircleHelp, Copy, LoaderCircle, MousePointerClick, PartyPopper, Share2, Sparkles, X } from "lucide-react";

import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type PaperTradeCloseProgressStage = "checking" | "awaiting_confirmation" | "closing" | "completed";

const completionStage = {
  title: "اكتمل الإغلاق",
  detail: "أُغلقت الصفقة الورقية وسُجلت نتيجتها في محفظتك.",
};

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
  completed: 100,
};

function stageIndex(stage: PaperTradeCloseProgressStage) {
  return stages.findIndex(item => item.id === stage);
}

function StageTooltip({ title, text, children }: { title: string; text: string; children: React.ReactNode }) {
  return <Tooltip><TooltipTrigger asChild>{children}</TooltipTrigger><TooltipContent dir="rtl" side="top" sideOffset={10} className="w-[min(20rem,calc(100vw-2rem))] rounded-xl border border-sky-200/20 bg-slate-950/95 p-0 text-right text-slate-100 shadow-2xl backdrop-blur-md"><div className="border-b border-sky-100/10 bg-sky-400/[0.08] px-3 py-2"><div className="flex items-center gap-2"><span className="flex size-6 items-center justify-center rounded-lg bg-sky-400/15 text-sky-100"><CircleHelp className="size-3.5" /></span><p className="text-xs font-semibold text-sky-100">{title}</p></div></div><div className="px-3 py-2.5"><p className="text-xs leading-5 text-slate-100/90">{text}</p><p className="mt-2 flex items-start gap-1.5 border-t border-white/[0.08] pt-2 text-[10px] leading-4 text-slate-400"><MousePointerClick className="mt-0.5 size-3 shrink-0 text-sky-300" />مرّر المؤشر أو انتقل بالمفاتيح أو اضغط لعرض الشرح.</p></div></TooltipContent></Tooltip>;
}

function getShareText(completionMessage?: string) {
  return `نتيجة تداول ورقي من AMIC\n${completionMessage ?? "أُغلقت صفقتي الورقية بنجاح."}\n\nلأغراض تعليمية ومحاكاة فقط، وليست نتيجة تداول حقيقي أو توصية استثمارية.`;
}

async function copyToClipboard(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  document.body.removeChild(textarea);
  if (!copied) throw new Error("clipboard_unavailable");
}

export function PaperTradeCloseProgress({
  stage,
  compact = false,
  className,
  completionMessage,
  onCompletionDismiss,
}: {
  stage: PaperTradeCloseProgressStage;
  compact?: boolean;
  className?: string;
  completionMessage?: string;
  onCompletionDismiss?: () => void;
}) {
  const isCompleted = stage === "completed";
  const activeIndex = stageIndex(stage);
  const activeStage = isCompleted ? completionStage : stages[activeIndex];
  const [shareStatus, setShareStatus] = React.useState<"shared" | "copied" | "error" | null>(null);
  const [isSharing, setIsSharing] = React.useState(false);
  const shareText = getShareText(completionMessage);

  const shareResult = async () => {
    if (isSharing) return;
    setShareStatus(null);
    setIsSharing(true);

    try {
      if (typeof navigator.share === "function") {
        try {
          await navigator.share({ title: "نتيجة تداول ورقي من AMIC", text: shareText });
          setShareStatus("shared");
          return;
        } catch (error) {
          if (error instanceof DOMException && error.name === "AbortError") return;
        }
      }

      await copyToClipboard(shareText);
      setShareStatus("copied");
    } catch {
      setShareStatus("error");
    } finally {
      setIsSharing(false);
    }
  };

  return (
    <section
      aria-label="تقدم إغلاق الصفقة الورقية"
      aria-live="polite"
      className={cn("relative overflow-hidden rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3 transition-[border-color,background-color,box-shadow] duration-300 motion-reduce:transition-none", isCompleted && "border-emerald-300/45 bg-emerald-400/[0.10] shadow-[0_0_0_1px_rgba(110,231,183,0.08),0_12px_32px_rgba(16,185,129,0.14)]", className)}
    >
      {isCompleted ? <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden"><div className="absolute -right-5 -top-7 size-24 rounded-full bg-emerald-300/20 blur-xl motion-safe:animate-pulse" /><div className="absolute left-[14%] top-3 size-2 rounded-full bg-amber-200/80 motion-safe:animate-ping" /><Sparkles className="absolute left-[8%] top-5 size-4 text-amber-200 motion-safe:animate-pulse" /><Sparkles className="absolute right-[24%] top-2 size-3 text-emerald-100 motion-safe:animate-pulse" /></div> : null}
      <div key={stage} className="flex items-start justify-between gap-3 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:slide-in-from-bottom-1 motion-safe:duration-200">
        <div className="relative min-w-0">
          <p className="text-sm font-semibold text-sky-100">{activeStage.title}</p>
          <p className={cn("mt-1 text-xs leading-5 text-sky-100/75", isCompleted && "text-emerald-50/85")}>{activeStage.detail}</p>
        </div>
        <span key={`${stage}-percent`} className={cn("relative shrink-0 font-mono text-xs text-sky-200 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-200", isCompleted && "font-semibold text-emerald-100")}>{progressByStage[stage]}%</span>
      </div>

      <Progress value={progressByStage[stage]} className={cn("relative mt-3 h-1.5 bg-sky-400/15 [&_[data-slot=progress-indicator]]:bg-sky-300 [&_[data-slot=progress-indicator]]:duration-500 [&_[data-slot=progress-indicator]]:ease-out motion-reduce:[&_[data-slot=progress-indicator]]:transition-none", isCompleted && "bg-emerald-300/15 [&_[data-slot=progress-indicator]]:bg-emerald-300")} />

      {isCompleted ? <div className="relative mt-3 flex items-start gap-3 rounded-lg border border-emerald-200/25 bg-emerald-300/[0.10] p-3 text-emerald-50 motion-safe:animate-in motion-safe:fade-in-0 motion-safe:zoom-in-95 motion-safe:duration-300"><span className="relative flex size-9 shrink-0 items-center justify-center rounded-full bg-emerald-200/15 text-emerald-100"><span aria-hidden="true" className="absolute inset-0 rounded-full border border-emerald-100/30 motion-safe:animate-ping" /><PartyPopper className="relative size-4 motion-safe:animate-pulse" /></span><div className="min-w-0 flex-1"><div role="status"><p className="text-sm font-semibold">نجاح: أُغلقت الصفقة الورقية</p><p className="mt-1 text-xs leading-5 text-emerald-50/85">{completionMessage ?? "سُجلت النتيجة وحدّثت بيانات محفظتك الورقية."}</p></div><div className="mt-3 flex flex-wrap items-center gap-2"><button type="button" onClick={() => void shareResult()} disabled={isSharing} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-emerald-100/25 bg-emerald-950/15 px-2.5 text-xs font-medium text-emerald-50 transition-[transform,background-color,opacity] duration-150 hover:bg-emerald-100/15 active:scale-95 disabled:cursor-wait disabled:opacity-70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 motion-reduce:transition-none">{isSharing ? <Copy className="size-3.5" /> : <Share2 className="size-3.5" />}{isSharing ? "جارٍ التجهيز…" : "مشاركة النتيجة"}</button>{shareStatus ? <p role="status" className={cn("text-[11px]", shareStatus === "error" ? "text-rose-100" : "text-emerald-50/85")}>{shareStatus === "shared" ? "فُتحت خيارات المشاركة." : shareStatus === "copied" ? <><Check className="ml-1 inline size-3" />نُسخت النتيجة للحافظة.</> : "تعذر فتح المشاركة أو نسخ النتيجة."}</p> : null}</div></div>{onCompletionDismiss ? <button type="button" onClick={onCompletionDismiss} aria-label="إخفاء رسالة نجاح الإغلاق" className="mr-auto inline-flex size-7 shrink-0 items-center justify-center rounded-md text-emerald-50/75 transition-[transform,background-color,color] duration-150 hover:bg-emerald-100/15 hover:text-emerald-50 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-100 motion-reduce:transition-none"><X className="size-4" /></button> : null}</div> : null}

      <ol className={cn("mt-3 grid gap-2", compact ? "grid-cols-3" : "sm:grid-cols-3")}>
        {stages.map((item, index) => {
          const isCurrent = !isCompleted && index === activeIndex;
          const isComplete = isCompleted || index < activeIndex;

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

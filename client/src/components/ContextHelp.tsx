import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { CircleHelp, Lightbulb } from "lucide-react";
import React, { type ReactNode } from "react";

type ContextHelpProps = {
  /** المصطلح الظاهر في تسمية زر المساعدة الميسر. */
  term: string;
  /** عنوان قصير يضع المفهوم في سياق الصفحة. */
  title?: string;
  /** شرح موجز للمفهوم أو للإجراء، لا يفترض معرفة مسبقة. */
  children: ReactNode;
  /** إرشاد عملي اختياري يجيب: ماذا أفعل بهذه المعلومة؟ */
  actionHint?: string;
  className?: string;
};

/**
 * شرح عند الطلب للمفاهيم التي قد تربك المستخدم. يعتمد النقر بدل المرور فقط،
 * لذلك يبقى صالحًا للهاتف ولوحة المفاتيح ولا يملأ الواجهة بنصوص دائمة.
 */
export function ContextHelp({ term, title = term, children, actionHint, className }: ContextHelpProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={cn("size-7 shrink-0 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary", className)}
          aria-label={`شرح ${term}`}
        >
          <CircleHelp className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent
        dir="rtl"
        role="dialog"
        aria-label={`شرح ${title}`}
        className="w-72 border-primary/20 bg-popover p-4 text-popover-foreground shadow-xl"
      >
        <div className="flex items-start gap-2.5">
          <Lightbulb className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden="true" />
          <div className="min-w-0">
            <h3 className="text-sm font-semibold">{title}</h3>
            <div className="mt-1.5 text-xs leading-5 text-muted-foreground">{children}</div>
            {actionHint ? <p className="mt-3 border-s border-primary/45 ps-2.5 text-xs leading-5 text-foreground/90"><span className="font-semibold text-primary">ما الذي أفعله؟ </span>{actionHint}</p> : null}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

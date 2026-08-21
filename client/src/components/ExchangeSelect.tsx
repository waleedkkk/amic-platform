import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { SUGGESTED_EXCHANGES } from "@/components/SymbolSelect";

type ExchangeSelectProps = {
  label: string;
  value: string;
  onChange: (exchange: string) => void;
  className?: string;
};

/** قائمة منسدلة للبورصات المقترحة مع إمكانية الكتابة اليدوية لأي بورصة غير موجودة. */
export function ExchangeSelect({ label, value, onChange, className }: ExchangeSelectProps) {
  const isSuggested = SUGGESTED_EXCHANGES.includes(value.toUpperCase());
  return (
    <div className={className}>
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>
      <div className="mt-2 flex gap-2">
        <Select value={isSuggested ? value.toUpperCase() : "__custom__"} onValueChange={next => { if (next !== "__custom__") onChange(next); }}>
          <SelectTrigger className="min-w-0 flex-1 bg-white/[0.025] font-mono">
            <SelectValue placeholder="اختر بورصة أو اكتبها" />
          </SelectTrigger>
          <SelectContent dir="rtl">
            {SUGGESTED_EXCHANGES.map(exchange => (
              <SelectItem key={exchange} value={exchange} className="font-mono">{exchange}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Input
          aria-label={`${label} يدويًا`}
          placeholder={isSuggested ? "بورصة أخرى…" : value || "بورصة…"}
          className={cn("w-28 shrink-0 bg-black/15 font-mono text-xs", isSuggested && "border-dashed")}
          value={isSuggested ? "" : value}
          onChange={event => onChange(event.target.value.toUpperCase())}
        />
      </div>
    </div>
  );
}

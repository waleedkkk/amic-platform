import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

/** قائمة رموز مقترحة مقسمة حسب الفئة — الرمز والبورصة المقابلة له. */
export const SUGGESTED_SYMBOLS: { symbol: string; exchange: string }[] = [
  // عملات رقمية (Binance)
  { symbol: "BTCUSDT", exchange: "BINANCE" },
  { symbol: "ETHUSDT", exchange: "BINANCE" },
  { symbol: "BNBUSDT", exchange: "BINANCE" },
  { symbol: "SOLUSDT", exchange: "BINANCE" },
  { symbol: "XRPUSDT", exchange: "BINANCE" },
  { symbol: "ADAUSDT", exchange: "BINANCE" },
  { symbol: "DOGEUSDT", exchange: "BINANCE" },
  { symbol: "AVAXUSDT", exchange: "BINANCE" },
  { symbol: "DOTUSDT", exchange: "BINANCE" },
  { symbol: "LINKUSDT", exchange: "BINANCE" },
  // أسهم أمريكية (Yahoo/TradingView)
  { symbol: "AAPL", exchange: "NASDAQ" },
  { symbol: "MSFT", exchange: "NASDAQ" },
  { symbol: "GOOGL", exchange: "NASDAQ" },
  { symbol: "AMZN", exchange: "NASDAQ" },
  { symbol: "NVDA", exchange: "NASDAQ" },
  { symbol: "TSLA", exchange: "NASDAQ" },
  { symbol: "META", exchange: "NASDAQ" },
  { symbol: "TSM", exchange: "NYSE" },
  { symbol: "KO", exchange: "NYSE" },
  { symbol: "JPM", exchange: "NYSE" },
  // عملات (Forex)
  { symbol: "EURUSD", exchange: "FX" },
  { symbol: "GBPUSD", exchange: "FX" },
  { symbol: "USDJPY", exchange: "FX" },
  { symbol: "USDCHF", exchange: "FX" },
  { symbol: "AUDUSD", exchange: "FX" },
  { symbol: "USDCAD", exchange: "FX" },
];

/** البورصات الشائعة لقوائم البورصات المنسدلة. */
export const SUGGESTED_EXCHANGES = ["BINANCE", "NASDAQ", "NYSE", "FX", "AMEX", "SSE"];
/** مجموعات الرموز مع تسمياتها لعرضها في القائمة المنسدلة. */
export const SYMBOL_GROUPS: { label: string; filter: (symbol: string) => boolean }[] = [
  { label: "العملات الرقمية", filter: symbol => symbol.endsWith("USDT") },
  { label: "الأسهم الأمريكية", filter: symbol => /^[A-Z]{1,5}$/.test(symbol) && !symbol.endsWith("USDT") },
  { label: "أزواج العملات", filter: symbol => /^(EUR|GBP|USD|JPY|CHF|AUD|CAD)[A-Z]{3}$/.test(symbol) },
];

type SymbolSelectContentProps = {
  /** دالة تُستدعى عند اختيار رمز من القائمة. */
  onSelect: (symbol: string) => void;
};

/** محتوى القائمة المنسدلة: رموز مقترحة مقسمة حسب الفئة. */
export function SymbolSelectContent({ onSelect }: SymbolSelectContentProps) {
  return (
    <SelectContent dir="rtl" className="max-h-80">
      {SYMBOL_GROUPS.map(group => (
        <div key={group.label}>
          <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground">{group.label}</div>
          {SUGGESTED_SYMBOLS.filter(entry => group.filter(entry.symbol)).map(entry => (
            <SelectItem key={entry.symbol} value={entry.symbol} className="font-mono">
              {entry.symbol}
            </SelectItem>
          ))}
        </div>
      ))}
    </SelectContent>
  );
}

type SymbolSelectProps = {
  label: string;
  value: string;
  onChange: (symbol: string) => void;
  className?: string;
  /** استدعاء إضافي عند اختيار رمز مقترح (مثل ضبط البورصة أو الفئة). */
  onSelect?: (symbol: string) => void;
  customPlaceholder?: string;
  customLabel?: string;
  required?: boolean;
};

/** قائمة منسدلة بالرموز المقترحة مع إمكانية الكتابة اليدوية لأي رمز غير موجود. */
export function SymbolSelect({ label, value, onChange, className, onSelect, customPlaceholder, customLabel, required }: SymbolSelectProps) {
  const suggested = SUGGESTED_SYMBOLS.find(entry => entry.symbol === value);
  const isSuggested = Boolean(suggested);
  const suggestedExchange = suggested?.exchange ?? "";
  return (
    <div className={className}>
      <label className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">{label}</label>
      <div className="mt-2 flex flex-col gap-2 min-[420px]:flex-row">
        <Select value={isSuggested ? value : "__custom__"} onValueChange={next => { if (next !== "__custom__") { onChange(next); onSelect?.(next); } }}>
          <SelectTrigger className="min-w-0 flex-1 bg-white/[0.025] font-mono">
            <SelectValue placeholder={customPlaceholder ?? "اختر رمزًا أو اكتبه"} />
          </SelectTrigger>
          <SymbolSelectContent onSelect={next => { onChange(next); onSelect?.(next); }} />
        </Select>
        <Input
          aria-label={`${customLabel ?? label} يدويًا`}
          required={required}
          placeholder={isSuggested ? (customPlaceholder ?? "رمز آخر…") : value || "رمز…"}
          className={cn("w-full shrink-0 bg-black/15 font-mono text-sm min-[420px]:w-28 min-[420px]:text-xs", isSuggested && "border-dashed")}
          value={isSuggested ? "" : value}
          onChange={event => onChange(event.target.value.toUpperCase())}
        />
      </div>
      {isSuggested && <p className="mt-1 text-[10px] text-muted-foreground">{suggestedExchange}</p>}
    </div>
  );
}

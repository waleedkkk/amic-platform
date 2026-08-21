import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ArrowUpRight, RefreshCw } from "lucide-react";
import { Link } from "wouter";

export type RecordValue = Record<string, unknown>;

export function safeRecord(value: unknown): RecordValue {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as RecordValue) : {};
}

export function asRows(value: unknown): RecordValue[] {
  if (Array.isArray(value)) return value.map(safeRecord).filter(row => Object.keys(row).length > 0);
  const record = safeRecord(value);
  const nested = Object.values(record).find(Array.isArray);
  return Array.isArray(nested) ? nested.map(safeRecord).filter(row => Object.keys(row).length > 0) : [];
}

export function findValue(value: unknown, candidates: string[], depth = 0): unknown {
  if (depth > 4 || !value || typeof value !== "object") return undefined;
  const record = safeRecord(value);
  for (const [key, candidateValue] of Object.entries(record)) {
    if (candidates.some(candidate => key.toLowerCase() === candidate.toLowerCase())) {
      if (candidateValue && typeof candidateValue === "object" && !Array.isArray(candidateValue)) {
        const nested = safeRecord(candidateValue);
        for (const preferred of [
          "value", "close", "current_price", "last", "level",
          "macd_line", "histogram", "line", "signal",
        ]) {
          if (preferred in nested) return nested[preferred];
        }
      }
      return candidateValue;
    }
  }
  for (const candidateValue of Object.values(record)) {
    if (candidateValue && typeof candidateValue === "object") {
      const found = findValue(candidateValue, candidates, depth + 1);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

export function formatValue(value: unknown, digits = 2) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "number" && Number.isFinite(value)) return new Intl.NumberFormat("ar", { maximumFractionDigits: digits }).format(value);
  if (typeof value === "string" && /^-?\d+(\.\d+)?$/.test(value)) return new Intl.NumberFormat("ar", { maximumFractionDigits: digits }).format(Number(value));
  return String(value);
}

export function signalLabel(value: unknown) {
  const raw = String(value ?? "").toLowerCase().replace(/[ -]/g, "_");
  const labels: Record<string, { label: string; tone: string }> = {
    strong_buy: { label: "شراء قوي", tone: "bg-emerald-400/15 text-emerald-300 border-emerald-400/25" },
    buy: { label: "شراء", tone: "bg-emerald-400/15 text-emerald-300 border-emerald-400/25" },
    neutral: { label: "محايد", tone: "bg-slate-300/10 text-slate-300 border-slate-300/15" },
    sell: { label: "بيع", tone: "bg-rose-400/15 text-rose-300 border-rose-400/25" },
    strong_sell: { label: "بيع قوي", tone: "bg-rose-400/15 text-rose-300 border-rose-400/25" },
  };
  return labels[raw] ?? { label: value ? String(value) : "بانتظار البيانات", tone: "bg-slate-300/10 text-slate-300 border-slate-300/15" };
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) {
  return (
    <header className="mb-5 flex min-w-0 flex-col gap-4 sm:mb-7 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <p className="mb-2 text-xs font-semibold tracking-[0.16em] text-primary">{eyebrow}</p>
        <h1 className="text-2xl font-semibold tracking-tight text-fade sm:text-3xl md:text-4xl">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {action ? <div className="w-full max-w-full shrink-0 self-start md:w-auto">{action}</div> : null}
    </header>
  );
}

export function Panel({ children, className }: { children: React.ReactNode; className?: string }) {
  return <section className={cn("rounded-2xl border border-white/[0.07] bg-card/85 p-4 panel-glow sm:p-5", className)}>{children}</section>;
}

export function MetricCard({ label, value, detail, positive, icon }: { label: string; value: React.ReactNode; detail?: React.ReactNode; positive?: boolean; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-white/[0.07] bg-card/80 p-4 panel-glow">
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        {icon}
      </div>
      <p className="mt-3 font-mono text-xl font-medium tracking-tight text-foreground sm:mt-4 sm:text-2xl">{value}</p>
      {detail ? <p className={cn("mt-2 text-xs", positive === undefined ? "text-muted-foreground" : positive ? "text-emerald-300" : "text-rose-300")}>{detail}</p> : null}
    </div>
  );
}

export function dataTableKeys(rows: RecordValue[]) {
  return Array.from(new Set(rows.flatMap(row => Object.keys(row)))).slice(0, 5);
}

export function DataTable({ rows, emptyLabel = "لا توجد بيانات معروضة حاليًا." }: { rows: RecordValue[]; emptyLabel?: string }) {
  if (!rows.length) return <div className="flex min-h-36 items-center justify-center rounded-xl border border-dashed border-white/10 text-sm text-muted-foreground">{emptyLabel}</div>;
  const keys = dataTableKeys(rows);
  return (
    <div>
      <div className="space-y-2 sm:hidden">
        {rows.map((row, index) => (
          <article key={`${String(row.symbol ?? row.ticker ?? index)}-${index}`} className="rounded-xl border border-white/[0.07] bg-white/[0.018] p-3">
            <div className="grid grid-cols-2 gap-x-3 gap-y-3">
              {keys.map(key => <div key={key} className="min-w-0"><p className="text-[11px] text-muted-foreground">{key}</p><p className={cn("mt-1 truncate text-sm text-slate-200", key === "السعر" ? "font-mono" : "")}>{typeof row[key] === "object" ? "تفاصيل" : formatValue(row[key])}</p></div>)}
            </div>
          </article>
        ))}
      </div>
      <div className="hidden overflow-x-auto sm:block">
        <table className="w-full min-w-[520px] text-right text-sm">
        <thead className="border-b border-white/[0.07] text-xs text-muted-foreground">
          <tr>{keys.map(key => <th key={key} className="px-3 py-3 font-medium">{key}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${String(row.symbol ?? row.ticker ?? index)}-${index}`} className="border-b border-white/[0.045] last:border-0 hover:bg-white/[0.018]">
              {keys.map(key => <td key={key} className={cn("px-3 py-3 text-slate-200", key === "السعر" ? "whitespace-nowrap font-mono text-[0.835rem]" : "")}>{typeof row[key] === "object" ? "تفاصيل" : formatValue(row[key])}</td>)}
            </tr>
          ))}
        </tbody>
        </table>
      </div>
    </div>
  );
}

export function LoadState({ loading, error, children }: { loading: boolean; error?: unknown; children: React.ReactNode }) {
  if (loading) return <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground"><RefreshCw className="size-4 animate-spin" /> جارٍ جلب بيانات السوق…</div>;
  if (error) return <div className="rounded-xl border border-rose-400/20 bg-rose-400/5 p-4 text-sm leading-6 text-rose-200">تعذّر الوصول إلى مزود بيانات السوق الآن. تحقق من خدمة التحليل ثم أعد المحاولة.</div>;
  return <>{children}</>;
}

export function EmptyAction({ title, description, href, action }: { title: string; description: string; href: string; action: string }) {
  return (
    <div className="rounded-xl border border-dashed border-white/10 px-5 py-8 text-center">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      <Button asChild size="sm" className="mt-4"><Link href={href}>{action}<ArrowUpRight className="mr-1 size-4" /></Link></Button>
    </div>
  );
}

export function SignalBadge({ value }: { value: unknown }) {
  const signal = signalLabel(value);
  return <Badge variant="outline" className={cn("border px-2 py-0.5 text-xs font-medium", signal.tone)}>{signal.label}</Badge>;
}

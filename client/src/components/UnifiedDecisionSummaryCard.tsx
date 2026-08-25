import React, { useState } from "react";
import { AlertTriangle, CheckCircle2, ChevronDown, CircleHelp, Database, ShieldAlert } from "lucide-react";
import type { DecisionPillar, UnifiedDecisionSummary } from "@shared/unifiedDecision";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/market-ui";

const STATE_COPY: Record<UnifiedDecisionSummary["state"], { label: string; tone: string; icon: typeof CheckCircle2 }> = {
  aligned_bullish: { label: "توافق صاعد تعليمي", tone: "border-cyan-400/30 bg-cyan-400/[0.08] text-cyan-100", icon: CheckCircle2 },
  aligned_bearish: { label: "توافق هابط تعليمي", tone: "border-fuchsia-400/30 bg-fuchsia-400/[0.08] text-fuchsia-100", icon: CheckCircle2 },
  needs_confirmation: { label: "اتجاه أولي يحتاج تأكيدًا", tone: "border-amber-400/30 bg-amber-400/[0.08] text-amber-100", icon: CircleHelp },
  conflicted: { label: "عوامل متعارضة", tone: "border-orange-400/30 bg-orange-400/[0.08] text-orange-100", icon: ShieldAlert },
  insufficient_data: { label: "بيانات غير كافية", tone: "border-slate-400/30 bg-slate-400/[0.08] text-slate-100", icon: Database },
  neutral: { label: "لا يوجد توافق اتجاهي واضح", tone: "border-slate-400/30 bg-slate-400/[0.08] text-slate-100", icon: CircleHelp },
};

const PILLAR_LABELS: Record<DecisionPillar["id"], string> = {
  core: "القراءة الأساسية",
  ict: "Confluence ICT",
  timeframes: "توافق الأطر",
  correlation: "السياق المترابط",
};

function contributionText(value: number) {
  return `${value > 0 ? "+" : ""}${value.toFixed(1)}`;
}

function freshnessText(value: DecisionPillar["freshness"]) {
  if (value === "fresh") return "حديثة";
  if (value === "stale") return "قديمة";
  return "غير معروفة";
}

function pillarTone(pillar: DecisionPillar) {
  if (!pillar.available) return "border-white/[0.08] bg-white/[0.02] text-muted-foreground";
  if (pillar.contribution > 0) return "border-cyan-400/20 bg-cyan-400/[0.05] text-cyan-100";
  if (pillar.contribution < 0) return "border-fuchsia-400/20 bg-fuchsia-400/[0.05] text-fuchsia-100";
  return "border-white/[0.08] bg-white/[0.02] text-muted-foreground";
}

function DecisionSkeleton() {
  return (
    <div role="region" aria-label="ملخص الأدلة">
      <Panel className="mt-4 animate-pulse border-white/[0.08] p-4">
        <div className="h-4 w-32 rounded bg-white/[0.08]" />
        <div className="mt-4 h-8 w-64 max-w-full rounded bg-white/[0.08]" />
        <div className="mt-4 h-2 w-full rounded bg-white/[0.08]" />
      </Panel>
    </div>
  );
}

export function UnifiedDecisionSummaryCard({
  summary,
  isLoading = false,
  error,
}: {
  summary?: UnifiedDecisionSummary;
  isLoading?: boolean;
  error?: string;
}) {
  const [expanded, setExpanded] = useState(false);

  if (isLoading && !summary) return <DecisionSkeleton />;

  if (error && !summary) {
    return (
      <div role="status" aria-label="ملخص الأدلة">
      <Panel className="mt-4 border-amber-400/25 bg-amber-400/[0.06] p-4 text-amber-100">
          <div className="flex min-w-0 items-start gap-3">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0">
              <p className="font-semibold">تعذر تجهيز ملخص الأدلة</p>
              <p className="mt-1 break-words text-sm leading-6 text-amber-100/80">{error}</p>
            </div>
          </div>
        </Panel>
      </div>
    );
  }

  if (!summary) return null;

  const stateCopy = STATE_COPY[summary.state];
  const StateIcon = stateCopy.icon;
  const directionText = summary.direction === "bullish" ? "صاعد" : summary.direction === "bearish" ? "هابط" : "محايد";

  return (
    <div dir="rtl" role="region" aria-label="ملخص الأدلة">
      <Panel className="mt-4 min-w-0 overflow-hidden border-white/[0.1] p-4 sm:p-5">
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-semibold tracking-[0.13em] text-primary">UNIFIED EVIDENCE</p>
          <h2 className="mt-2 text-lg font-semibold text-foreground">ملخص الأدلة</h2>
          <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{summary.summary}</p>
        </div>
        <div className={`inline-flex max-w-full shrink-0 items-center gap-2 rounded-full border px-3 py-2 text-sm font-semibold ${stateCopy.tone}`} role="status" aria-live="polite">
          <StateIcon className="size-4 shrink-0" aria-hidden="true" />
          <span className="break-words">{stateCopy.label}</span>
        </div>
      </div>

      <div className="mt-5 grid min-w-0 gap-3 sm:grid-cols-2">
        <div className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">جودة اتفاق الأدلة</span>
            <strong className="font-mono text-foreground">{summary.evidenceScore}/100</strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-label="جودة اتفاق الأدلة" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.evidenceScore}>
            <div className="h-full rounded-full bg-gradient-to-l from-cyan-300 to-sky-500 transition-[width] duration-300" style={{ width: `${summary.evidenceScore}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">اتفاق الاتجاهات، وليس احتمال الربح.</p>
        </div>
        <div className="min-w-0 rounded-xl border border-white/[0.08] bg-white/[0.025] p-3.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted-foreground">درجة التغطية</span>
            <strong className="font-mono text-foreground">{summary.coveragePercent}%</strong>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/[0.08]" role="progressbar" aria-label="درجة تغطية الأدلة" aria-valuemin={0} aria-valuemax={100} aria-valuenow={summary.coveragePercent}>
            <div className="h-full rounded-full bg-gradient-to-l from-violet-300 to-fuchsia-500 transition-[width] duration-300" style={{ width: `${summary.coveragePercent}%` }} />
          </div>
          <p className="mt-2 text-xs text-muted-foreground">اتجاه الملخص: {directionText}.</p>
        </div>
      </div>

      {summary.blockedBy.length > 0 ? (
        <div className="mt-4 flex min-w-0 items-start gap-2 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-sm text-amber-100">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          <p className="min-w-0 break-words">{summary.blockedBy.includes("core_ict_conflict") ? "التوصية الأساسية وICT متعارضان." : summary.blockedBy.includes("ict_gate") ? "بوابة ICT لم تجتز حد التأكيد." : summary.blockedBy.includes("data_quality") ? "جودة أو حداثة أحد المصادر لا تكفي لتوافق قوي." : "توجد أطر زمنية متعارضة تحتاج مراجعة."}</p>
        </div>
      ) : null}

      <Button type="button" variant="outline" className="mt-4 h-auto min-h-9 max-w-full gap-2 bg-white/[0.03] px-3 py-2 text-xs whitespace-normal" onClick={() => setExpanded(value => !value)} aria-expanded={expanded}>
        <ChevronDown className={`size-4 shrink-0 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
        {expanded ? "إخفاء أسباب التقييم" : "عرض أسباب التقييم"}
      </Button>

      {expanded ? (
        <div className="mt-3 grid min-w-0 gap-2 sm:grid-cols-2" aria-label="ركائز ملخص الأدلة">
          {summary.pillars.map(pillar => (
            <div key={pillar.id} className={`min-w-0 rounded-xl border p-3 ${pillarTone(pillar)}`}>
              <div className="flex items-start justify-between gap-3">
                <p className="min-w-0 break-words text-sm font-semibold">{PILLAR_LABELS[pillar.id]}</p>
                <span className="shrink-0 font-mono text-xs">{pillar.available ? contributionText(pillar.contribution) : "—"}</span>
              </div>
              <p className="mt-1 break-words text-xs leading-5 opacity-80">{pillar.summary}</p>
              <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] opacity-70">
                <span>{pillar.available ? `الوزن ${pillar.weight}` : "غير متاحة"}</span>
                <span>{freshnessText(pillar.freshness)}</span>
              </div>
              {pillar.reasons.length > 0 ? <p className="mt-2 break-words text-xs leading-5 opacity-75">{pillar.reasons[0]}</p> : null}
            </div>
          ))}
        </div>
      ) : null}

      <p className="mt-4 break-words text-xs leading-5 text-muted-foreground">{summary.educationalDisclaimer}</p>
      </Panel>
    </div>
  );
}

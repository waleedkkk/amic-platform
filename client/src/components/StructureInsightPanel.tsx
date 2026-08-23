import { Panel } from "@/components/market-ui";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { RiskLevelSource } from "@/lib/paperTradeDraft";
import { trpc } from "@/lib/trpc";
import { explainStructureInsights, type StructureInsight } from "@shared/structureInsights";
import type { PriceLevel, PriceZone } from "@shared/marketStructure";
import { BadgeInfo, Bell, ShieldAlert, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

type ProposedRiskLevels = { stopLoss: string; takeProfit: string; stopLossSource: RiskLevelSource; takeProfitSource: RiskLevelSource };
type AlertInterval = "5m" | "15m" | "1h" | "4h" | "1d" | "1wk";
type ContextEvent = "approach" | "touch" | "invalidation";

function insightClass(strength: StructureInsight["strength"]) { if (strength === "strong") return "border-emerald-400/25 bg-emerald-400/[0.06] text-emerald-200"; if (strength === "moderate") return "border-amber-400/25 bg-amber-400/[0.06] text-amber-100"; if (strength === "invalidated") return "border-rose-400/25 bg-rose-400/[0.06] text-rose-200"; return "border-white/[0.12] bg-white/[0.03] text-muted-foreground"; }
function displayPrice(value: number, digits = 4) { return value.toLocaleString("en-US", { maximumFractionDigits: digits }); }
function kindFor(insight: StructureInsight) { if (insight.type === "zone") return insight.title.includes("طلب") ? "demand_zone" as const : "supply_zone" as const; return insight.title.includes("دعم") ? "support" as const : "resistance" as const; }

function SourceLink({ title, source, targetValue, insights }: { title: string; source: RiskLevelSource; targetValue: string; insights: StructureInsight[] }) {
  const linked = source.level === undefined ? undefined : insights.find(insight => insight.price !== undefined && Math.abs(insight.price - source.level!) / Math.max(Math.abs(source.level!), 1) < 0.006);
  return <div className="rounded-lg border border-white/[0.08] bg-black/20 p-3"><p className="text-xs text-muted-foreground">{title}</p><p className="mt-1 font-mono text-sm text-foreground">{targetValue}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{source.kind === "fallback" ? source.label : linked ? `${source.label} · يطابق ${linked.title.toLowerCase()} في خريطة البنية.` : `${source.label} · مستوى تحليل يستخدم كمرجع للمسودة.`}</p></div>;
}

export function StructureInsightPanel({ symbol, exchange, interval, currentPrice, levels, zones, proposedRiskLevels }: { symbol: string; exchange: string; interval: AlertInterval; currentPrice: number | null; levels: PriceLevel[]; zones: PriceZone[]; proposedRiskLevels?: ProposedRiskLevels | null }) {
  const insights = useMemo(() => explainStructureInsights(levels, zones, currentPrice, symbol, exchange), [currentPrice, exchange, levels, symbol, zones]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [eventType, setEventType] = useState<ContextEvent>("approach");
  const utils = trpc.useUtils();
  const alerts = trpc.structureContextAlerts.list.useQuery(undefined, { staleTime: 30_000, refetchOnWindowFocus: false });
  const create = trpc.structureContextAlerts.create.useMutation({ onSuccess: () => { toast.success("حُفظ تنبيه السياق. سيعمل مع فحص Heartbeat المجدول."); void utils.structureContextAlerts.list.invalidate(); }, onError: error => toast.error(error.message) });
  const cancel = trpc.structureContextAlerts.cancel.useMutation({ onSuccess: () => { toast.success("أُلغي تنبيه السياق."); void utils.structureContextAlerts.list.invalidate(); }, onError: error => toast.error(error.message) });
  useEffect(() => setSelectedId(insights[0]?.id ?? null), [symbol, exchange, insights]);
  const selected = insights.find(item => item.id === selectedId) ?? insights[0];
  if (!insights.length) return null;
  const addAlert = () => {
    if (!selected) return;
    create.mutate({ symbol, exchange, interval, sourceKind: kindFor(selected), sourceLabel: `${selected.title} · ${selected.source}`, referencePrice: String(selected.price ?? ((selected.range!.low + selected.range!.high) / 2)), rangeLow: selected.range ? String(selected.range.low) : null, rangeHigh: selected.range ? String(selected.range.high) : null, invalidationPrice: String(selected.invalidation), eventType, proximityBps: 15 });
  };
  const ownActive = (alerts.data ?? []).filter(alert => alert.status === "active" && alert.symbol === symbol && alert.exchange === exchange);
  return <Panel className="mt-3" aria-label="تفسير المستويات والمناطق">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.13em] text-primary">STRUCTURE EXPLAINER</p><h2 className="mt-2 text-lg font-semibold">مصدر المستويات ومناطق السعر</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">اختر عنصرًا لفهم مصدره وقوته وحد الإبطال. هذه قراءة بنيوية وليست ضمانًا لرد فعل السعر.</p></div><BadgeInfo className="size-5 text-primary" /></div>
    <div className="mt-4 flex flex-wrap gap-2">{insights.map(insight => <button key={insight.id} type="button" onClick={() => setSelectedId(insight.id)} aria-pressed={selected?.id === insight.id} className={`rounded-lg border px-2.5 py-2 text-xs transition-colors ${selected?.id === insight.id ? "border-primary/60 bg-primary/15 text-primary" : insightClass(insight.strength)}`}>{insight.title} · {insight.strengthLabel}</button>)}</div>
    {selected ? <><div className="mt-4 grid gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-4 sm:grid-cols-[1.15fr_0.85fr]"><div><p className="font-semibold text-foreground">{selected.title} <span className={`mr-2 rounded px-1.5 py-0.5 text-[10px] ${insightClass(selected.strength)}`}>{selected.strengthLabel}</span></p><p className="mt-2 text-xs leading-5 text-muted-foreground"><span className="text-foreground">المصدر:</span> {selected.source}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{selected.description}</p><p className="mt-2 text-xs text-muted-foreground">اكتُشف: {new Date(selected.createdAt * 1000).toLocaleDateString("ar-EG")}</p></div><div className="grid content-start gap-2 text-xs"><div className="rounded-lg border border-white/[0.08] bg-white/[0.025] p-3"><p className="text-muted-foreground">{selected.range ? "نطاق المنطقة" : "سعر المستوى"}</p><p className="mt-1 font-mono text-foreground">{selected.range ? `${displayPrice(selected.range.low, selected.digits)} – ${displayPrice(selected.range.high, selected.digits)}` : displayPrice(selected.price ?? 0, selected.digits)}</p></div><div className="rounded-lg border border-rose-400/15 bg-rose-400/[0.04] p-3"><p className="text-muted-foreground">حد الإبطال</p><p className="mt-1 font-mono text-foreground">{displayPrice(selected.invalidation, selected.digits)}</p><p className="mt-1 text-[11px] text-muted-foreground">يبعد {selected.distanceToInvalidation === null ? "—" : `${selected.distanceToInvalidation.toLocaleString("en-US", { maximumFractionDigits: selected.digits })} ${selected.distanceUnit}`}</p></div></div></div>
      <div className="mt-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-3"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm font-semibold">تنبيه سياقي اختياري</p><p className="mt-1 text-xs text-muted-foreground">يراقب Heartbeat هذا العنصر مرة واحدة حتى يتحقق الحدث؛ لا يمثل توصية أو تنفيذًا تلقائيًا.</p></div><div className="flex items-center gap-2"><Select value={eventType} onValueChange={value => setEventType(value as ContextEvent)}><SelectTrigger className="h-9 w-32 bg-black/15 text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="approach">اقتراب</SelectItem><SelectItem value="touch">لمس</SelectItem><SelectItem value="invalidation">إبطال</SelectItem></SelectContent></Select><Button size="sm" onClick={addAlert} disabled={create.isPending || selected.strength === "invalidated"}><Bell className="ml-1.5 size-3.5" />إنشاء تنبيه</Button></div></div></div></> : null}
    {ownActive.length ? <div className="mt-3 rounded-xl border border-white/[0.08] bg-white/[0.02] p-3"><p className="text-xs font-semibold text-muted-foreground">تنبيهاتك النشطة لهذا الأصل</p><div className="mt-2 space-y-2">{ownActive.map(alert => <div key={alert.id} className="flex items-center justify-between gap-3 rounded-lg bg-black/20 px-3 py-2 text-xs"><span className="min-w-0 truncate">{alert.sourceLabel} · {alert.eventType}</span><Button variant="ghost" size="icon" className="size-7 text-rose-300" aria-label="إلغاء التنبيه" disabled={cancel.isPending} onClick={() => cancel.mutate({ id: alert.id })}><Trash2 className="size-3.5" /></Button></div>)}</div></div> : null}
    {proposedRiskLevels ? <section className="mt-4 rounded-xl border border-amber-400/20 bg-amber-400/[0.04] p-3"><div className="flex items-center gap-2"><ShieldAlert className="size-4 text-amber-300" /><p className="text-sm font-semibold text-foreground">ربط مستويات مسودة المخاطرة</p></div><p className="mt-1 text-xs leading-5 text-muted-foreground">يوضح مصدر المستويات المستخدمة في وقف الخسارة وجني الربح المقترحين؛ تبقى القيم قابلة للتعديل.</p><div className="mt-3 grid gap-2 sm:grid-cols-2"><SourceLink title="وقف الخسارة المقترح" source={proposedRiskLevels.stopLossSource} targetValue={proposedRiskLevels.stopLoss} insights={insights} /><SourceLink title="جني الربح المقترح" source={proposedRiskLevels.takeProfitSource} targetValue={proposedRiskLevels.takeProfit} insights={insights} /></div></section> : null}
  </Panel>;
}

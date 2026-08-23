import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUGGESTED_SYMBOLS, SymbolSelect } from "@/components/SymbolSelect";
import { formatValue, Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { correlationLabel, EXTERNAL_CONTEXT_REFERENCE_OPTIONS, MAX_EXTERNAL_CONTEXT_REFERENCES, type ExternalContextReference } from "@shared/analysisExternalContext";
import { ChevronDown, ChevronUp, Link2, Plus, Settings2, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";

function referenceLabel(reference: ExternalContextReference) {
  return EXTERNAL_CONTEXT_REFERENCE_OPTIONS.find(option => option.symbol === reference.symbol && option.exchange === reference.exchange)?.label ?? `${reference.symbol} · ${reference.exchange}`;
}

function correlationTone(tone: "positive" | "negative" | "neutral") {
  return tone === "positive" ? "text-emerald-300" : tone === "negative" ? "text-rose-300" : "text-muted-foreground";
}

export function ExternalContextCards({ symbol, exchange }: { symbol: string; exchange: string }) {
  const utils = trpc.useUtils();
  const [expanded, setExpanded] = useState(true);
  const [editing, setEditing] = useState(false);
  const [referenceSymbol, setReferenceSymbol] = useState("XAGUSD");
  const [referenceExchange, setReferenceExchange] = useState("FX");
  const preferencesQuery = trpc.market.externalContext.getPreferences.useQuery(undefined, { staleTime: 60_000, refetchOnWindowFocus: false });
  const references = preferencesQuery.data?.references ?? [];
  const cardsQuery = trpc.market.externalContext.cards.useQuery({ symbol, exchange }, { enabled: references.length > 0, staleTime: 75_000, refetchInterval: 90_000, refetchOnWindowFocus: true, retry: 1 });
  const savePreferences = trpc.market.externalContext.savePreferences.useMutation({ onSuccess: () => { void utils.market.externalContext.getPreferences.invalidate(); void utils.market.externalContext.cards.invalidate(); } });
  const visibleReferences = useMemo(() => references.filter(reference => !(reference.symbol === symbol && reference.exchange === exchange)), [exchange, references, symbol]);

  const save = (next: ExternalContextReference[]) => savePreferences.mutate({ references: next });
  const addReference = () => {
    const next = [...references, { symbol: referenceSymbol.trim().toUpperCase(), exchange: referenceExchange.trim().toUpperCase() }];
    save(next);
  };
  const removeReference = (reference: ExternalContextReference) => save(references.filter(item => !(item.symbol === reference.symbol && item.exchange === reference.exchange)));

  return <Panel className="mt-6" aria-label="سياق خارجي اختياري">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.13em] text-primary">OPTIONAL MARKET CONTEXT</p><h2 className="mt-2 text-lg font-semibold">سياق خارجي للأصل</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">راجع أصولًا مرجعية تختارها أنت. الارتباط إحصائي ضمن التاريخ المتاح ولا يعني علاقة سببية أو توصية.</p></div><div className="flex gap-2"><Button variant="outline" size="sm" className="bg-white/[0.03]" onClick={() => setEditing(open => !open)}><Settings2 className="ml-1.5 size-3.5" />تخصيص</Button><Button variant="outline" size="icon" className="bg-white/[0.03]" aria-label={expanded ? "طي بطاقات السياق" : "توسيع بطاقات السياق"} onClick={() => setExpanded(open => !open)}>{expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</Button></div></div>
    {editing ? <div className="mt-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-3"><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm font-medium">الرموز المرجعية لحسابك</p><span className="font-mono text-xs text-muted-foreground">{references.length}/{MAX_EXTERNAL_CONTEXT_REFERENCES}</span></div><div className="mt-3 grid gap-3 sm:grid-cols-[1fr_140px_auto]"><SymbolSelect label="الرمز المرجعي" value={referenceSymbol} onChange={setReferenceSymbol} onSelect={value => { const selected = SUGGESTED_SYMBOLS.find(item => item.symbol === value); if (selected) setReferenceExchange(selected.exchange); }} customLabel="رمز مرجعي مخصص" /><div><Label>البورصة</Label><Input className="mt-2 bg-white/[0.025] font-mono" value={referenceExchange} onChange={event => setReferenceExchange(event.target.value.toUpperCase())} /></div><Button className="self-end" disabled={savePreferences.isPending || references.length >= MAX_EXTERNAL_CONTEXT_REFERENCES || !referenceSymbol.trim() || !referenceExchange.trim()} onClick={addReference}><Plus className="ml-1.5 size-4" />إضافة</Button></div><div className="mt-3 flex flex-wrap gap-2">{references.length ? references.map(reference => <span key={`${reference.exchange}:${reference.symbol}`} className="inline-flex items-center gap-1 rounded-md border border-white/[0.1] bg-black/20 px-2 py-1 text-xs"><span className="font-mono">{reference.symbol}</span><span className="text-muted-foreground">{reference.exchange}</span><button type="button" aria-label={`حذف ${reference.symbol}`} onClick={() => removeReference(reference)} disabled={savePreferences.isPending} className="mr-1 rounded p-0.5 text-rose-300 hover:bg-rose-400/10"><Trash2 className="size-3.5" /></button></span>) : <p className="text-xs text-muted-foreground">أضف أصلًا واحدًا على الأقل لإظهار بطاقات السياق.</p>}</div></div> : null}
    {expanded ? <div className="mt-4">{preferencesQuery.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل تفضيلات السياق…</p> : !visibleReferences.length ? <div className="rounded-xl border border-dashed border-white/[0.12] px-4 py-6 text-center text-sm text-muted-foreground">اختر رموزًا مرجعية من «تخصيص» لبناء سياقك الخاص لهذا الأصل.</div> : cardsQuery.isLoading ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{visibleReferences.map(reference => <div key={`${reference.exchange}:${reference.symbol}`} className="h-32 animate-pulse rounded-xl bg-white/[0.04]" />)}</div> : cardsQuery.isError ? <p className="rounded-xl border border-amber-400/20 bg-amber-400/[0.05] px-4 py-3 text-sm text-amber-100">تعذّر تحديث بطاقات السياق الآن. تبقى اختياراتك محفوظة ويمكنك إعادة المحاولة لاحقًا.</p> : <><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{(cardsQuery.data?.cards ?? []).map(card => { const relationship = correlationLabel(card.correlation); return <article key={`${card.exchange}:${card.symbol}`} className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-mono font-semibold">{card.symbol}</p><p className="mt-1 text-xs text-muted-foreground">{referenceLabel(card)}</p></div><Link2 className="size-4 text-primary" /></div><p className="mt-4 font-mono text-lg">{formatValue(card.price, 4)}</p><p className={`mt-1 text-xs ${typeof card.changePercent === "number" && card.changePercent < 0 ? "text-rose-300" : "text-emerald-300"}`}>{typeof card.changePercent === "number" ? `${card.changePercent >= 0 ? "+" : ""}${formatValue(card.changePercent, 2)}%` : "التغير غير متاح"}</p><div className="mt-3 border-t border-white/[0.07] pt-3"><p className={`text-xs ${correlationTone(relationship.tone)}`}>{relationship.label}</p><p className="mt-1 font-mono text-[11px] text-muted-foreground">r {card.correlation === null ? "—" : card.correlation.toFixed(2)} · {card.sampleSize} عوائد</p></div></article>; })}</div><p className="mt-3 text-[11px] leading-5 text-muted-foreground">العلاقة محسوبة من عوائد الإغلاق اليومية المتداخلة في التاريخ المتاح. لا تستخدمها وحدها لتوقع الاتجاه أو اتخاذ قرار تداول.</p></>}</div> : null}
  </Panel>;
}

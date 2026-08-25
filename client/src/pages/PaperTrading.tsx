import { TradeDecisionReadinessCard } from "@/components/TradeDecisionReadinessCard";
import { EmptyAction, formatValue, PageHeading, Panel, SignalBadge } from "@/components/market-ui";
import { PaperTradeAlertCenter } from "@/components/PaperTradeAlertCenter";
import { PaperTradeCloseProgress, type PaperTradeCloseProgressStage } from "@/components/PaperTradeCloseProgress";
import type { PaperTradeAlert } from "@/hooks/usePaperTradeAlerts";
import { usePaperTradeAlerts } from "@/hooks/usePaperTradeAlerts";
import { SUGGESTED_SYMBOLS, SymbolSelect } from "@/components/SymbolSelect";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { assessTradeRisk, consumePaperTradeDraft, type RiskLevelSource } from "@/lib/paperTradeDraft";
import { trpc } from "@/lib/trpc";
import { AlertTriangle, ArrowDownToLine, ArrowUpFromLine, ChartNoAxesCombined, ShieldAlert, Target, WalletCards } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

type TradeForm = {
  symbol: string;
  exchange: string;
  assetClass: "crypto" | "stock" | "forex" | "futures";
  side: "long" | "short";
  quantity: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  note: string;
  signalId?: number;
};

type DraftRiskSources = { stopLossSource: RiskLevelSource; takeProfitSource: RiskLevelSource };

type PendingCloseConfirmation = {
  id: number;
  closePrice: string;
  symbol: string;
  exchange: string;
  referencePrice: string;
  priceDeviationPercent: number;
};

function paperTradeAssetKey(symbol: string, exchange: string) {
  return `${exchange.trim().toUpperCase()}:${symbol.trim().toUpperCase()}`;
}

const initialForm: TradeForm = { symbol: "BTCUSDT", exchange: "BINANCE", assetClass: "crypto", side: "long", quantity: "", entryPrice: "", stopLoss: "", takeProfit: "", note: "" };

function assetClassForExchange(exchange: string): TradeForm["assetClass"] {
  const normalized = exchange.toUpperCase();
  if (normalized === "BINANCE") return "crypto";
  if (normalized === "FX" || normalized === "FOREX") return "forex";
  if (normalized === "OZ" || normalized === "COMEX") return "futures";
  return "stock";
}

export default function PaperTrading() {
  const [form, setForm] = useState<TradeForm>(initialForm);
  const { alerts, status: paperTradeSocketStatus, dismissAlert, clearAlerts } = usePaperTradeAlerts();
  const lastToastedAlert = useRef<string | null>(null);
  const [draftRiskSources, setDraftRiskSources] = useState<DraftRiskSources | null>(null);
  const [closePrices, setClosePrices] = useState<Record<number, string>>({});
  const [pendingClose, setPendingClose] = useState<PendingCloseConfirmation | null>(null);
  const [closeProgress, setCloseProgress] = useState<{ tradeId: number; stage: PaperTradeCloseProgressStage } | null>(null);
  const utils = trpc.useUtils();
  const trades = trpc.paperTrading.list.useQuery();
  const referencePrices = trpc.paperTrading.referencePrices.useQuery(undefined, { staleTime: 30_000, refetchOnWindowFocus: true });
  const summary = trpc.paperTrading.summary.useQuery();
  const signalPerformance = trpc.paperTrading.signalPerformance.useQuery();
  const riskAssessment = useMemo(() => assessTradeRisk(form), [form]);
  const referenceByAsset = useMemo(() => new Map((referencePrices.data ?? []).map(item => [paperTradeAssetKey(item.symbol, item.exchange), item.reference])), [referencePrices.data]);
  const refreshTrades = () => { void utils.paperTrading.list.invalidate(); void utils.paperTrading.summary.invalidate(); void utils.paperTrading.referencePrices.invalidate(); };
  const updateForm = (patch: Partial<TradeForm>, preservesRiskSources = false) => {
    setForm(current => {
      const changesInstrument = (patch.symbol !== undefined && patch.symbol.trim().toUpperCase() !== current.symbol.trim().toUpperCase())
        || (patch.exchange !== undefined && patch.exchange.trim().toUpperCase() !== current.exchange.trim().toUpperCase());
      return { ...current, ...patch, ...(changesInstrument ? { signalId: undefined } : {}) };
    });
    if (!preservesRiskSources) setDraftRiskSources(null);
  };

  const open = trpc.paperTrading.open.useMutation({
    onSuccess: () => { toast.success("فُتحت الصفقة الورقية."); setForm(initialForm); setDraftRiskSources(null); refreshTrades(); },
    onError: error => toast.error(error.message),
  });
  const close = trpc.paperTrading.close.useMutation({
    onSuccess: result => {
      if (!result.closed) {
        if (result.requiresConfirmation && result.referencePrice && result.priceDeviationPercent !== null) {
          const trade = openTrades.find(item => item.id === result.id);
          if (trade) {
            setCloseProgress({ tradeId: trade.id, stage: "awaiting_confirmation" });
            setPendingClose({ id: trade.id, closePrice: closePrices[trade.id] ?? "", symbol: trade.symbol, exchange: trade.exchange, referencePrice: result.referencePrice, priceDeviationPercent: result.priceDeviationPercent });
          }
        } else {
          setCloseProgress(null);
          toast.error("تعذر إغلاق الصفقة؛ لم يكتمل الفحص المرجعي.");
        }
        return;
      }
      setPendingClose(null);
      setCloseProgress(null);
      toast.success(`أُغلقت الصفقة. الربح/الخسارة المحققة: ${formatValue(result.realizedPnl, 4)}. يمكنك طلب نقد تعليمي اختياري من صفحة نقد الصفقات.`);
      refreshTrades();
    },
    onError: error => {
      setCloseProgress(null);
      toast.error(error.message);
    },
  });

  const requestClose = (tradeId: number) => {
    const closePrice = closePrices[tradeId]?.trim();
    if (!closePrice) return toast.error("أدخل سعر الإغلاق أولًا.");
    setCloseProgress({ tradeId, stage: "checking" });
    close.mutate({ id: tradeId, closePrice, confirmPriceDeviation: false });
  };

  useEffect(() => {
    const draft = consumePaperTradeDraft();
    if (!draft) return;
    setForm(draft);
    setDraftRiskSources(draft.riskSources ?? null);
    toast.info("حُمّلت مسودة الصفقة من التحليل. راجعها وعدّلها قبل الفتح.");
  }, []);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (riskAssessment.warnings.length) return toast.error("صحّح تحذيرات المخاطرة والعائد قبل فتح الصفقة.");
    open.mutate({ ...form, symbol: form.symbol.toUpperCase(), exchange: form.exchange.toUpperCase(), stopLoss: form.stopLoss || undefined, takeProfit: form.takeProfit || undefined, note: form.note || undefined, signalId: form.signalId });
  };

  const openTrades = trades.data?.filter(trade => trade.status === "open") ?? [];
  const closedTrades = trades.data?.filter(trade => trade.status === "closed") ?? [];

  useEffect(() => {
    const latestAlert = alerts[0];
    if (!latestAlert || lastToastedAlert.current === latestAlert.eventId) return;
    lastToastedAlert.current = latestAlert.eventId;

    if (latestAlert.type === "paper_trade.close_deviation_detected") {
      toast.warning(`تحذير انحراف سعري في ${latestAlert.symbol}`, {
        description: `سعر الإغلاق يبعد ${latestAlert.deviationPercent?.toFixed(2) ?? "—"}% عن السعر المرجعي. راجع مركز التنبيهات قبل التأكيد.`,
      });
    } else {
      refreshTrades();
    }
  }, [alerts]);

  const handleAlertSelect = (alert: PaperTradeAlert) => {
    if (alert.type === "paper_trade.closed") {
      refreshTrades();
      return;
    }
    if (!alert.requestedClosePrice || !alert.referencePrice || alert.deviationPercent === null || alert.deviationPercent === undefined) return;
    const trade = openTrades.find(item => item.id === alert.tradeId);
    if (!trade) {
      void utils.paperTrading.list.invalidate();
      return;
    }
    setPendingClose({
      id: trade.id,
      closePrice: alert.requestedClosePrice,
      symbol: trade.symbol,
      exchange: trade.exchange,
      referencePrice: alert.referencePrice,
      priceDeviationPercent: alert.deviationPercent,
    });
    setCloseProgress({ tradeId: trade.id, stage: "awaiting_confirmation" });
  };

  return <>
    <PageHeading eyebrow="PAPER PORTFOLIO" title="التداول الورقي" description="افتح وأغلق صفقات محاكاة داخل حسابك. تُعزل المراكز والإشارات لكل مستخدم، ولا تُرسل أي أوامر إلى وسيط حقيقي." action={<PaperTradeAlertCenter alerts={alerts} status={paperTradeSocketStatus} onDismiss={dismissAlert} onClear={clearAlerts} onSelect={handleAlertSelect} />} />
    <div className="mb-6 grid gap-3 sm:grid-cols-4">
      {[["إجمالي الصفقات", summary.data?.totalTrades ?? "—"], ["المفتوحة", summary.data?.openTrades ?? "—"], ["نسبة النجاح", summary.data?.winRate === null || summary.data?.winRate === undefined ? "—" : `${summary.data.winRate}%`], ["الربح/الخسارة المحققة", summary.data ? formatValue(summary.data.realizedPnl, 5) : "—"]].map(([label, value]) => <Panel key={String(label)} className="p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><ChartNoAxesCombined className="size-3.5 text-primary" />{label}</div><p className="mt-2 font-mono text-lg">{value}</p></Panel>)}
    </div>
    <Panel className="mb-6 p-4"><div className="flex items-start gap-3"><div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-sky-400/10 text-sky-300"><Target className="size-4" /></div><div className="min-w-0"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-semibold">متابعة الإشارات المحفوظة</h2><span className="font-mono text-sm text-sky-200">{signalPerformance.data?.winRate == null ? "بانتظار بيانات كافية" : `${signalPerformance.data.winRate}%`}</span></div><p className="mt-1 text-xs leading-5 text-muted-foreground">قُيّمت {signalPerformance.data?.measuredSignals ?? 0} من أصل {signalPerformance.data?.trackedSignals ?? 0} إشارة وفق اتجاه حركة الإغلاق اليومية بعد حفظها. هذا مؤشر متابعة تعليمي مبدئي، وليس توصية أو إثباتًا لفعالية مستقبلية.</p><div className="mt-3 flex flex-wrap gap-2 text-xs"><span className="rounded-md bg-emerald-400/10 px-2 py-1 text-emerald-200">متوافقة: {signalPerformance.data?.successfulSignals ?? 0}</span><span className="rounded-md bg-rose-400/10 px-2 py-1 text-rose-200">غير متوافقة: {signalPerformance.data?.unfavorableSignals ?? 0}</span><span className="rounded-md bg-white/[0.05] px-2 py-1 text-muted-foreground">قيد المتابعة: {signalPerformance.data?.pendingSignals ?? 0}</span></div></div></div></Panel>
    <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
      <Panel><div className="flex items-center gap-3"><div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary"><WalletCards className="size-5" /></div><div><h2 className="font-semibold">فتح صفقة محاكاة</h2><p className="text-xs text-muted-foreground">راجع كل القيم قبل الفتح؛ هي للتدريب والتوثيق فقط.</p></div></div>
        <form className="mt-6 grid gap-4 sm:grid-cols-2" onSubmit={submit}>
          <SymbolSelect required label="الرمز" value={form.symbol} onChange={symbol => updateForm({ symbol })} onSelect={symbol => { const entry = SUGGESTED_SYMBOLS.find(item => item.symbol === symbol); if (entry) updateForm({ symbol, exchange: entry.exchange, assetClass: assetClassForExchange(entry.exchange) }); }} />
          <div><Label>البورصة</Label><Input required className="mt-2 bg-white/[0.025] font-mono" value={form.exchange} onChange={event => updateForm({ exchange: event.target.value })} /></div>
          <div><Label>الفئة</Label><Select value={form.assetClass} onValueChange={value => updateForm({ assetClass: value as TradeForm["assetClass"] })}><SelectTrigger className="mt-2 bg-white/[0.025]"><SelectValue /></SelectTrigger><SelectContent>{["crypto", "stock", "forex", "futures"].map(item => <SelectItem key={item} value={item}>{item}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>الاتجاه</Label><Select value={form.side} onValueChange={value => updateForm({ side: value as TradeForm["side"] })}><SelectTrigger className="mt-2 bg-white/[0.025]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="long">شراء / Long</SelectItem><SelectItem value="short">بيع / Short</SelectItem></SelectContent></Select></div>
          <div><Label>الكمية</Label><Input required inputMode="decimal" className="mt-2 bg-white/[0.025] font-mono" value={form.quantity} onChange={event => updateForm({ quantity: event.target.value })} /></div>
          <div><Label>سعر الدخول</Label><Input required inputMode="decimal" className="mt-2 bg-white/[0.025] font-mono" value={form.entryPrice} onChange={event => updateForm({ entryPrice: event.target.value })} /></div>
          <div><Label>وقف الخسارة (اختياري)</Label><Input inputMode="decimal" className="mt-2 bg-white/[0.025] font-mono" value={form.stopLoss} onChange={event => updateForm({ stopLoss: event.target.value })} /></div>
          <div><Label>جني الربح (اختياري)</Label><Input inputMode="decimal" className="mt-2 bg-white/[0.025] font-mono" value={form.takeProfit} onChange={event => updateForm({ takeProfit: event.target.value })} /></div>
          <div className="sm:col-span-2 rounded-xl border border-sky-400/20 bg-sky-400/[0.06] p-3" aria-live="polite"><div className="flex items-start gap-2"><Target className="mt-0.5 size-4 shrink-0 text-sky-300" /><div><p className="text-sm font-semibold text-sky-100">نسبة العائد إلى المخاطرة</p><p className="mt-1 font-mono text-lg text-sky-200">{riskAssessment.riskRewardRatio ? `${riskAssessment.riskRewardRatio.toFixed(2)} : 1` : "—"}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">{riskAssessment.hasCompletePlan ? "العائد المحتمل لكل وحدة مخاطرة، بناءً على القيم التي أدخلتها." : "أدخل سعر الدخول ووقف الخسارة وجني الربح بقيم منطقية لعرض النسبة."}</p></div></div></div>
          <TradeDecisionReadinessCard draft={form} riskSources={draftRiskSources} />
          {riskAssessment.warnings.length ? <div className="sm:col-span-2 rounded-xl border border-amber-400/35 bg-amber-400/[0.10] p-3 text-sm text-amber-100" role="alert"><div className="flex gap-2"><ShieldAlert className="mt-0.5 size-4 shrink-0" /><div><p className="font-semibold">تحذير قبل فتح الصفقة</p><ul className="mt-1 list-disc space-y-1 pr-4 text-xs leading-5 text-amber-100/90">{riskAssessment.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div></div></div> : null}
          <div className="sm:col-span-2"><Label>ملاحظة</Label><Input className="mt-2 bg-white/[0.025]" value={form.note} onChange={event => updateForm({ note: event.target.value }, true)} /></div>
          <Button disabled={open.isPending || riskAssessment.warnings.length > 0} className="min-h-11 sm:col-span-2" type="submit"><ArrowUpFromLine className="ml-2 size-4" />فتح صفقة ورقية</Button>
          {riskAssessment.warnings.length ? <p className="sm:col-span-2 flex items-center gap-1.5 text-xs text-amber-200"><AlertTriangle className="size-3.5" />يُعاد تفعيل الحفظ بعد تصحيح القيم التحذيرية.</p> : null}
        </form>
      </Panel>
      <div className="space-y-4">
        <Panel><div className="mb-5 flex items-center justify-between gap-3"><div><h2 className="font-semibold">المراكز المفتوحة</h2><p className="mt-1 text-xs text-muted-foreground">{trades.isLoading ? "—" : `${openTrades.length} مركز ضمن حسابك`}</p></div><SignalBadge value="neutral" /></div>{trades.isLoading ? <p className="text-sm text-muted-foreground">جارٍ تحميل المراكز…</p> : openTrades.length ? <div className="space-y-3">{openTrades.map(trade => {
          const activeCloseStage = closeProgress?.tradeId === trade.id ? closeProgress.stage : null;
          return <div key={trade.id} className="rounded-xl border border-white/[0.07] bg-white/[0.02] p-4"><div className="flex flex-col gap-3 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between"><div><p className="font-mono text-sm font-medium">{trade.symbol} <span className="text-muted-foreground">· {trade.exchange}</span></p><p className="mt-1 text-xs leading-5 text-muted-foreground">{trade.side === "long" ? "Long" : "Short"} · كمية {formatValue(trade.quantity, 6)} · دخول {formatValue(trade.entryPrice, 6)}</p><p className="mt-1 text-xs leading-5 text-muted-foreground">SL: {trade.stopLoss ? formatValue(trade.stopLoss, 6) : "—"} · TP: {trade.takeProfit ? formatValue(trade.takeProfit, 6) : "—"}</p></div><div className="flex flex-col gap-2 min-[420px]:flex-row"><div className="min-w-0"><p className="mb-1 text-[11px] text-muted-foreground">{referencePrices.isLoading ? "جارٍ جلب السعر المرجعي…" : referenceByAsset.get(paperTradeAssetKey(trade.symbol, trade.exchange))?.price ? `آخر سعر معروف: ${formatValue(referenceByAsset.get(paperTradeAssetKey(trade.symbol, trade.exchange))!.price, 6)}` : "لا يتوفر سعر مرجعي حالي"}</p><Input aria-label="سعر الإغلاق" inputMode="decimal" placeholder="سعر الإغلاق" className="h-11 w-full bg-black/15 font-mono text-sm min-[420px]:h-9 min-[420px]:w-28 min-[420px]:text-xs" value={closePrices[trade.id] ?? ""} onChange={event => { setClosePrices({ ...closePrices, [trade.id]: event.target.value }); setCloseProgress(current => current?.tradeId === trade.id ? null : current); }} /><Button size="sm" variant="outline" className="min-h-11 w-full bg-white/[0.03] min-[420px]:min-h-0 min-[420px]:w-auto" disabled={!closePrices[trade.id] || close.isPending} onClick={() => requestClose(trade.id)}><ArrowDownToLine className="ml-1 size-3.5" />{activeCloseStage === "checking" ? "جارٍ الفحص…" : "إغلاق"}</Button></div></div></div>{activeCloseStage ? <PaperTradeCloseProgress stage={activeCloseStage} compact className="mt-3" /> : null}</div>;
        })}</div> : <EmptyAction title="لا توجد مراكز مفتوحة" description="عند فتح صفقة محاكاة ستظهر هنا مع أداة لإغلاقها وحساب الربح أو الخسارة." href="/analysis" action="راجع التحليل أولًا" />}</Panel>
        <Panel><h2 className="font-semibold">سجل الصفقات المغلقة</h2><div className="mt-4 space-y-2">{closedTrades.length ? closedTrades.slice(0, 8).map(trade => <div key={trade.id} className="flex items-center justify-between gap-3 rounded-lg bg-white/[0.025] px-3 py-2 text-sm"><span className="truncate font-mono">{trade.symbol}</span><span className={Number(trade.realizedPnl) >= 0 ? "shrink-0 font-mono text-emerald-300" : "shrink-0 font-mono text-rose-300"}>{formatValue(trade.realizedPnl, 5)}</span></div>) : <p className="text-sm text-muted-foreground">لا توجد صفقات مغلقة بعد.</p>}</div></Panel>
      </div>
    </div>
    <AlertDialog open={Boolean(pendingClose)} onOpenChange={openState => { if (!openState && !close.isPending) { setCloseProgress(current => current?.tradeId === pendingClose?.id ? null : current); setPendingClose(null); } }}>
      <AlertDialogContent dir="rtl">
        <AlertDialogHeader>
          <AlertDialogTitle>تأكيد الإغلاق بسعر بعيد</AlertDialogTitle>
          <AlertDialogDescription>
            سعر الإغلاق للصفقة {pendingClose?.symbol} ({pendingClose?.exchange}) يبعد {pendingClose ? `${pendingClose.priceDeviationPercent.toFixed(2)}%` : "—"} عن آخر سعر معروف ({pendingClose?.referencePrice ?? "—"}). هل تريد تأكيد الإغلاق يدويًا بهذا السعر؟
          </AlertDialogDescription>
        </AlertDialogHeader>
        {pendingClose ? <PaperTradeCloseProgress stage={close.isPending ? "closing" : "awaiting_confirmation"} /> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={close.isPending}>إلغاء</AlertDialogCancel>
          <AlertDialogAction
            disabled={close.isPending}
            onClick={event => {
              event.preventDefault();
              if (!pendingClose) return;
              setCloseProgress({ tradeId: pendingClose.id, stage: "closing" });
              close.mutate({ id: pendingClose.id, closePrice: pendingClose.closePrice, confirmPriceDeviation: true });
            }}
          >
            {close.isPending ? "جارٍ الإغلاق…" : "تأكيد الإغلاق"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}

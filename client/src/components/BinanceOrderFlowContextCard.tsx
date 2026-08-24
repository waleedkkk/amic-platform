import { Button } from "@/components/ui/button";
import { Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { BINANCE_ORDER_FLOW_SYMBOLS, MAX_LOCAL_ORDER_FLOW_SYMBOLS, isSupportedBinanceOrderFlowSymbol, orderFlowPercent, orderFlowStatusLabel } from "@/lib/binanceOrderFlowEngine";
import { useBinanceOrderFlow } from "@/lib/useBinanceOrderFlow";
import { BinanceCvdLiveChart } from "@/components/BinanceCvdLiveChart";
import { DEFAULT_ORDER_FLOW_PREFERENCES, MAX_LARGE_TRADE_NOTIONAL, MIN_LARGE_TRADE_NOTIONAL, ORDER_FLOW_DEPTH_LEVEL_OPTIONS, type OrderFlowPreferences } from "../../../shared/orderFlowPreferences";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Activity, ChevronDown, ChevronUp, CircleGauge, ListPlus, Radio, RefreshCw, Settings2, Wifi, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export function BinanceOrderFlowContextCard({ symbol, exchange }: { symbol: string; exchange: string }) {
  const utils = trpc.useUtils();
  const [reconnectKey, setReconnectKey] = useState(0);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [cvdOpen, setCvdOpen] = useState(true);
  const [draft, setDraft] = useState<OrderFlowPreferences>(DEFAULT_ORDER_FLOW_PREFERENCES);
  const preferences = trpc.market.pulse.getPreferences.useQuery(undefined, { staleTime: 30_000 });
  const orderFlowPreferences = trpc.orderFlow.getPreferences.useQuery(undefined, { staleTime: 30_000 });
  const activePreferences = orderFlowPreferences.data ?? DEFAULT_ORDER_FLOW_PREFERENCES;
  useEffect(() => {
    if (orderFlowPreferences.data) setDraft(orderFlowPreferences.data);
  }, [orderFlowPreferences.data]);
  const currentSupported = isSupportedBinanceOrderFlowSymbol(symbol, exchange);
  const watchlistSymbols = useMemo(() => (preferences.data?.watchlist ?? [])
    .filter(item => item.exchange.toUpperCase() === "BINANCE" && BINANCE_ORDER_FLOW_SYMBOLS.includes(item.symbol.toUpperCase() as (typeof BINANCE_ORDER_FLOW_SYMBOLS)[number]))
    .map(item => item.symbol.toUpperCase()), [preferences.data?.watchlist]);
  const activeSymbols = useMemo(() => Array.from(new Set([...(currentSupported ? [symbol.toUpperCase()] : []), ...watchlistSymbols])).slice(0, MAX_LOCAL_ORDER_FLOW_SYMBOLS), [currentSupported, symbol, watchlistSymbols]);
  const snapshots = useBinanceOrderFlow(activeSymbols, activePreferences, reconnectKey);
  const primary = snapshots.find(item => item.symbol === symbol.toUpperCase()) ?? null;
  const saved = watchlistSymbols.includes(symbol.toUpperCase());
  const addSymbol = trpc.market.pulse.addSymbol.useMutation({
    onSuccess: () => { void utils.market.pulse.getPreferences.invalidate(); toast.success("أضيف الرمز إلى قائمة المراقبة الشخصية."); },
    onError: error => toast.error(error.message),
  });
  const savePreferences = trpc.orderFlow.savePreferences.useMutation({
    onSuccess: async preferences => {
      await utils.orderFlow.getPreferences.invalidate();
      setDraft(preferences);
      setSettingsOpen(false);
      toast.success("حُفظت إعدادات تدفق الأوامر لهذا الحساب.");
    },
    onError: error => toast.error(error.message),
  });

  const statusIcon = primary?.status === "live" ? <Wifi className="size-4 text-emerald-300" /> : <WifiOff className="size-4 text-amber-200" />;
  const imbalanceTone = (primary?.depthImbalance ?? 0) > 0.08 ? "text-emerald-300" : (primary?.depthImbalance ?? 0) < -0.08 ? "text-rose-300" : "text-amber-200";
  const cvdTone = (primary?.cvdApprox ?? 0) > 0 ? "text-emerald-300" : (primary?.cvdApprox ?? 0) < 0 ? "text-rose-300" : "text-muted-foreground";

  return <Panel className="mt-6" aria-label="سياق تدفق أوامر Binance">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.13em] text-primary">LOCAL BINANCE ORDER FLOW</p><h2 className="mt-2 text-lg font-semibold">سياق تدفق أوامر Binance</h2><p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">يقرأ هذا المتصفح عمقًا مختصرًا وصفقات لحظية من Binance Spot فقط. عدم التوازن وCVD هنا تقديريان ولا يغيران التلاقي أو يمثلان توصية.</p></div><div className="flex items-center gap-2 text-xs text-muted-foreground"><Radio className="size-3.5 text-primary" />اتصال محلي · لا تخزين للدفتر الخام</div></div>
    {!currentSupported ? <div className="mt-4 rounded-xl border border-dashed border-white/[0.12] px-4 py-5 text-center text-sm text-muted-foreground">تدعم النسخة الأولى رموز Binance Spot المحددة من القائمة فقط. اختر رمزًا مثل BTCUSDT أو ETHUSDT لعرض تدفق الأوامر.</div> : <>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4"><article className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">حالة المصدر</p><p className="mt-2 flex items-center gap-2 text-sm font-medium">{statusIcon}{primary ? orderFlowStatusLabel(primary.status) : "جارٍ التهيئة"}</p></article><article className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">عدم توازن العمق</p><p className={`mt-2 font-mono text-lg ${imbalanceTone}`}>{orderFlowPercent(primary?.depthImbalance ?? null)}</p></article><article className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">CVD تقديري · 5 دقائق</p><p className={`mt-2 font-mono text-lg ${cvdTone}`}>{primary ? primary.cvdApprox.toFixed(4) : "—"}</p></article><article className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-4"><p className="text-xs text-muted-foreground">أحداث كبيرة مرصودة</p><p className="mt-2 flex items-center gap-2 font-mono text-lg"><Activity className="size-4 text-primary" />{primary?.events.length ?? 0}</p></article></div>
      <div className="mt-4 flex items-center justify-between gap-3"><p className="text-sm font-medium">لوحة CVD الحية</p><Button size="sm" variant="ghost" aria-controls="binance-cvd-panel" aria-expanded={cvdOpen} onClick={() => setCvdOpen(open => !open)}>{cvdOpen ? <ChevronUp className="ml-1.5 size-4" /> : <ChevronDown className="ml-1.5 size-4" />}{cvdOpen ? "إخفاء الرسم" : "إظهار الرسم"}</Button></div>
      {cvdOpen ? <div id="binance-cvd-panel"><BinanceCvdLiveChart points={primary?.cvdSeries ?? []} symbol={symbol.toUpperCase()} depthLevels={activePreferences.depthLevels} largeTradeMinNotional={activePreferences.largeTradeMinNotional} /></div> : null}
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span>{primary?.updatedAt ? `آخر تحديث ${new Date(primary.updatedAt).toLocaleTimeString("ar-EG")}` : "بانتظار أول تحديث"}</span><span>·</span><span>عمق الحساب: {activePreferences.depthLevels} مستويات لكل جانب ({primary?.depthLevels ?? 0} مستوى مستلم)</span><span>·</span><span>{activeSymbols.length}/{MAX_LOCAL_ORDER_FLOW_SYMBOLS} رموز نشطة في هذا المتصفح</span></div>
      {primary?.events.length ? <div className="mt-3 flex flex-wrap gap-2">{primary.events.map(event => <span key={event.id} className={`rounded-full border px-2.5 py-1 text-xs ${event.side === "aggressive_buy" ? "border-emerald-400/25 bg-emerald-400/10 text-emerald-200" : "border-rose-400/25 bg-rose-400/10 text-rose-200"}`}>{event.side === "aggressive_buy" ? "صفقة شراء كبيرة" : "صفقة بيع كبيرة"} · {event.notional.toLocaleString("en-US", { maximumFractionDigits: 0 })} USDT</span>)}</div> : null}
      <div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" className="bg-white/[0.03]" onClick={() => setReconnectKey(key => key + 1)}><RefreshCw className="ml-1.5 size-4" />إعادة الاتصال</Button><Button size="sm" variant="outline" className="bg-white/[0.03]" onClick={() => setSettingsOpen(open => !open)}><Settings2 className="ml-1.5 size-4" />إعدادات القراءة</Button>{!saved ? <Button size="sm" onClick={() => addSymbol.mutate({ symbol: symbol.toUpperCase(), exchange: "BINANCE" })} disabled={addSymbol.isPending || watchlistSymbols.length >= MAX_LOCAL_ORDER_FLOW_SYMBOLS}><ListPlus className="ml-1.5 size-4" />إضافة لقائمة التدفق</Button> : <span className="inline-flex items-center rounded-md border border-primary/25 bg-primary/[0.08] px-3 text-xs text-primary">ضمن قائمة المراقبة</span>}</div>
      {settingsOpen ? <div className="mt-4 grid gap-3 rounded-xl border border-primary/20 bg-primary/[0.04] p-4 sm:grid-cols-[1fr_0.8fr_auto]"><div><Label htmlFor="large-trade-threshold" className="text-xs">الحد الأدنى للصفقة الكبيرة (USDT)</Label><Input id="large-trade-threshold" type="number" min={MIN_LARGE_TRADE_NOTIONAL} max={MAX_LARGE_TRADE_NOTIONAL} step={1000} className="mt-2 bg-background/30 font-mono" value={draft.largeTradeMinNotional} onChange={event => setDraft(previous => ({ ...previous, largeTradeMinNotional: Math.max(MIN_LARGE_TRADE_NOTIONAL, Math.min(MAX_LARGE_TRADE_NOTIONAL, Math.round(Number(event.target.value) || MIN_LARGE_TRADE_NOTIONAL))) }))} /></div><div><Label className="text-xs">عمق دفتر الأوامر</Label><Select value={String(draft.depthLevels)} onValueChange={value => setDraft(previous => ({ ...previous, depthLevels: Number(value) as OrderFlowPreferences["depthLevels"] }))}><SelectTrigger className="mt-2 bg-background/30"><SelectValue /></SelectTrigger><SelectContent>{ORDER_FLOW_DEPTH_LEVEL_OPTIONS.map(level => <SelectItem key={level} value={String(level)}>{level} مستويات لكل جانب</SelectItem>)}</SelectContent></Select></div><div className="flex items-end gap-2"><Button size="sm" onClick={() => savePreferences.mutate(draft)} disabled={savePreferences.isPending}>{savePreferences.isPending ? "جارٍ الحفظ…" : "حفظ"}</Button><Button size="sm" variant="ghost" onClick={() => setDraft(DEFAULT_ORDER_FLOW_PREFERENCES)}>افتراضي</Button></div><p className="sm:col-span-3 text-xs leading-5 text-muted-foreground">يطبق عمق الدفتر على أفضل مستويات الشراء والبيع في حساب عدم التوازن، ويمنع الحد الأدنى المنخفض تمييز عمليات صغيرة كأحداث كبيرة. لا تغير هذه الإعدادات مصدر Binance أو توصية المنصة.</p></div> : null}
      {activeSymbols.length > 1 ? <div className="mt-4 flex flex-wrap gap-2">{snapshots.map(item => <span key={item.symbol} className="rounded-full border border-white/[0.1] bg-white/[0.025] px-2.5 py-1 text-xs text-muted-foreground"><CircleGauge className="ml-1 inline size-3 text-primary" />{item.symbol}: {orderFlowPercent(item.depthImbalance)}</span>)}</div> : null}
    </>}
  </Panel>;
}

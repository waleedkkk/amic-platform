import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { findValue, formatValue, LoadState, MetricCard, PageHeading, Panel, SignalBadge } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { ChartNoAxesCombined, Search } from "lucide-react";
import { useMemo, useState } from "react";

export default function Confluence() {
  const [form, setForm] = useState({ symbol: "BTCUSDT", exchange: "BINANCE" });
  const [params, setParams] = useState(form);
  const query = trpc.market.multiTimeframe.useQuery(useMemo(() => params, [params]), { refetchOnWindowFocus: false });
  const data = query.data;
  const summary = findValue(data, ["summary", "overall", "recommendation", "trend"]);
  const frames = ["15m", "1h", "4h", "1D", "1W"];
  return <><PageHeading eyebrow="CONFLUENCE ENGINE" title="توافق الأطر الزمنية" description="قراءة مركّبة لاتجاه الأصل عبر الأطر القصيرة والمتوسطة والطويلة لتحديد مدى اتساق السياق الفني." /><Panel><form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={event => { event.preventDefault(); setParams(form); }}><div><Label>الرمز</Label><Input value={form.symbol} className="mt-2 bg-white/[0.025] font-mono" onChange={event => setForm({ ...form, symbol: event.target.value.toUpperCase() })} /></div><div><Label>البورصة</Label><Input value={form.exchange} className="mt-2 bg-white/[0.025] font-mono" onChange={event => setForm({ ...form, exchange: event.target.value.toUpperCase() })} /></div><div className="flex items-end"><Button type="submit" className="w-full">فحص التوافق <Search className="mr-2 size-4" /></Button></div></form></Panel><div className="mt-6"><LoadState loading={query.isLoading} error={query.error}><div className="grid gap-4 md:grid-cols-5">{frames.map(frame => <MetricCard key={frame} label={frame} value={formatValue(findValue(data, [frame, `${frame}_signal`, `${frame}_trend`]))} detail="قراءة الإطار" icon={<ChartNoAxesCombined className="size-4 text-primary" />} />)}</div><div className="mt-6 grid gap-4 lg:grid-cols-[0.7fr_1.3fr]"><Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">AGGREGATE READ</p><div className="mt-4"><SignalBadge value={summary} /></div><p className="mt-4 text-sm leading-7 text-muted-foreground">يُظهر هذا الملخص ما يعيده التحليل متعدد الأطر من خدمة السوق، ويُستخدم كقراءة للسياق لا كتعليمات تداول.</p></Panel><Panel><p className="text-xs font-semibold tracking-[0.13em] text-primary">RAW CONFLUENCE</p><pre className="mt-4 max-h-96 overflow-auto rounded-xl bg-black/15 p-4 text-left font-mono text-xs leading-6 text-slate-300" dir="ltr">{JSON.stringify(data ?? {}, null, 2)}</pre></Panel></div></LoadState></div></>;
}

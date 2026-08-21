import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ExchangeSelect } from "@/components/ExchangeSelect";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { asRows, DataTable, LoadState, PageHeading, Panel } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { Filter, SlidersHorizontal } from "lucide-react";
import { useMemo, useState } from "react";

const timeframes = ["5m", "15m", "1h", "4h", "1D", "1W"] as const;
export default function MarketScanner() {
  const [draft, setDraft] = useState({ exchange: "BINANCE", timeframe: "1h" as (typeof timeframes)[number], rating: "all", limit: "20" });
  const [filters, setFilters] = useState(draft);
  const input = useMemo(() => ({ exchange: filters.exchange, timeframe: filters.timeframe, rating: filters.rating === "all" ? undefined : Number(filters.rating), limit: Math.max(1, Math.min(50, Number(filters.limit) || 20)) }), [filters]);
  const query = trpc.market.screener.useQuery(input, { refetchOnWindowFocus: false });
  return <><PageHeading eyebrow="MARKET SCANNER" title="ماسح السوق" description="فلترة مخرجات السوق بحسب البورصة والإطار الزمني وتصنيف Bollinger. تُعرض البيانات الحالية فقط، ويمكن تعديل نطاق الفحص في أي وقت." /><Panel><form className="grid gap-4 md:grid-cols-4" onSubmit={event => { event.preventDefault(); setFilters(draft); }}><ExchangeSelect label="البورصة" value={draft.exchange} onChange={exchange => setDraft({ ...draft, exchange })} /><div><Label>الإطار الزمني</Label><Select value={draft.timeframe} onValueChange={value => setDraft({ ...draft, timeframe: value as (typeof timeframes)[number] })}><SelectTrigger className="mt-2 bg-white/[0.025]"><SelectValue /></SelectTrigger><SelectContent>{timeframes.map(frame => <SelectItem value={frame} key={frame}>{frame}</SelectItem>)}</SelectContent></Select></div><div><Label>تقييم Bollinger</Label><Select value={draft.rating} onValueChange={value => setDraft({ ...draft, rating: value })}><SelectTrigger className="mt-2 bg-white/[0.025]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">أفضل الرابحين</SelectItem>{[-3, -2, -1, 1, 2, 3].map(value => <SelectItem key={value} value={String(value)}>{value > 0 ? `شراء +${value}` : `بيع ${value}`}</SelectItem>)}</SelectContent></Select></div><div><Label>الحد الأقصى</Label><div className="mt-2 flex gap-2"><Input type="number" min="1" max="50" className="bg-white/[0.025]" value={draft.limit} onChange={event => setDraft({ ...draft, limit: event.target.value })} /><Button type="submit" size="icon"><Filter className="size-4" /></Button></div></div></form></Panel><Panel className="mt-6"><div className="mb-5 flex items-center justify-between"><div><h2 className="font-semibold">نتائج الفحص</h2><p className="mt-1 text-xs text-muted-foreground">{input.exchange} · {input.timeframe} · حتى {input.limit} نتيجة</p></div><SlidersHorizontal className="size-5 text-primary" /></div><LoadState loading={query.isLoading} error={query.error}><DataTable rows={asRows(query.data)} emptyLabel="لم تُرجع عوامل الفلترة الحالية نتائج." /></LoadState></Panel></>;
}

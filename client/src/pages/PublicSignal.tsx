import { Card, CardContent } from "@/components/ui/card";
import { SignalBadge } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { BarChart3, ShieldCheck } from "lucide-react";
import { Link, useRoute } from "wouter";

export default function PublicSignal() {
  const [, params] = useRoute("/signal/:shareId");
  const shareId = params?.shareId ?? "";
  const signalQuery = trpc.signals.getPublicSignal.useQuery({ shareId }, { enabled: Boolean(shareId), retry: false });
  const signal = signalQuery.data;

  return <main className="min-h-screen bg-[#050910] px-4 py-10 text-foreground sm:px-6"><div className="mx-auto max-w-2xl"><Link href="/" className="text-xs font-semibold tracking-[0.13em] text-primary">AMIC MARKET INTELLIGENCE</Link><Card className="mt-5 border-white/[0.1] bg-white/[0.03]"><CardContent className="p-6 sm:p-8">{signalQuery.isLoading ? <p className="text-sm text-muted-foreground">جارٍ فتح الإشارة المشتركة…</p> : signal ? <><div className="flex flex-wrap items-start justify-between gap-4"><div><div className="flex size-11 items-center justify-center rounded-xl bg-primary/15 text-primary"><BarChart3 className="size-5" /></div><p className="mt-5 font-mono text-lg font-semibold">{signal.symbol}</p><p className="mt-1 text-sm text-muted-foreground">{signal.exchange} · {signal.timeframe}</p></div><SignalBadge value={signal.recommendation} /></div><h1 className="mt-7 text-xl font-semibold">إشارة سوق مشتركة</h1><p className="mt-3 text-sm leading-7 text-muted-foreground">{signal.summary}</p><dl className="mt-7 grid gap-3 rounded-xl border border-white/[0.08] bg-black/20 p-4 sm:grid-cols-2"><div><dt className="text-xs text-muted-foreground">الثقة</dt><dd className="mt-1 font-mono text-lg">{signal.confidence}/100</dd></div><div><dt className="text-xs text-muted-foreground">تاريخ الحفظ</dt><dd className="mt-1 text-sm">{new Date(signal.createdAt).toLocaleString("ar")}</dd></div></dl><p className="mt-6 rounded-xl border border-amber-400/20 bg-amber-400/[0.06] p-3 text-xs leading-6 text-amber-100">هذه قراءة تعليمية عامة وليست نصيحة استثمارية أو أمرًا بالتداول.</p></> : <><h1 className="text-xl font-semibold">الرابط غير متاح</h1><p className="mt-3 text-sm leading-6 text-muted-foreground">قد يكون الرابط غير صحيح أو لم تعد الإشارة متاحة للمشاركة.</p></>}<div className="mt-7 flex items-center gap-2 text-xs text-muted-foreground"><ShieldCheck className="size-4 text-primary" />لا تعرض هذه الصفحة البريد أو الحساب أو سجل التحليل الخاص.</div></CardContent></Card></div></main>;
}

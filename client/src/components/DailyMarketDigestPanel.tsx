import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { Newspaper, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export function DailyMarketDigestPanel() {
  const utils = trpc.useUtils();
  const subscription = trpc.economicCalendar.subscription.get.useQuery();
  const [enabled, setEnabled] = useState(false);
  useEffect(() => { if (subscription.data) setEnabled(subscription.data.dailyDigestEnabled); }, [subscription.data]);
  const save = trpc.economicCalendar.digest.save.useMutation({ onSuccess: () => { toast.success("حُفظ إعداد الملخص اليومي."); utils.economicCalendar.subscription.get.invalidate(); }, onError: error => toast.error(error.message) });
  const preview = trpc.economicCalendar.digest.preview.useQuery(undefined, { enabled: false, retry: 0 });
  return <section className="mt-4 rounded-2xl border border-white/[0.08] bg-white/[0.018] p-4"><div className="flex flex-wrap items-start justify-between gap-3"><div className="flex gap-3"><Newspaper className="mt-0.5 size-5 text-primary" /><div><h3 className="text-sm font-semibold">ملخص السوق اليومي</h3><p className="mt-1 text-xs leading-5 text-muted-foreground">يجمع لقطة السوق ورابحي وخاسري Binance من أدوات MCP الحالية، ثم يرسله عبر تيليغرام فقط عند اشتراكك الصريح.</p></div></div><Button size="sm" variant={enabled ? "default" : "outline"} onClick={() => setEnabled(value => !value)}>{enabled ? "مفعّل" : "غير مفعّل"}</Button></div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" disabled={save.isPending} onClick={() => save.mutate({ enabled })}><Newspaper className="ml-1 size-4" />حفظ الاشتراك</Button><Button size="sm" variant="outline" disabled={preview.isFetching} onClick={() => preview.refetch()}>{preview.isFetching ? <RefreshCcw className="ml-1 size-4 animate-spin" /> : <RefreshCcw className="ml-1 size-4" />}معاينة الملخص</Button></div>{preview.isError && <p className="mt-3 text-xs text-destructive">تعذّر توليد المعاينة من مزود السوق الآن. جرّب لاحقًا.</p>}{preview.data && <pre className="mt-4 max-h-56 overflow-auto whitespace-pre-wrap rounded-xl bg-black/20 p-3 text-right text-xs leading-6 text-muted-foreground">{preview.data.text}</pre>}</section>;
}

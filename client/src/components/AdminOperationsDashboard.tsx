import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { MetricCard, Panel, formatValue } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { Activity, Bot, DatabaseZap, RefreshCw, ShieldCheck, Trash2, UsersRound, WalletCards } from "lucide-react";
import { useState } from "react";

export function AdminOperationsDashboard() {
  const utils = trpc.useUtils();
  const overview = trpc.auth.admin.dashboard.overview.useQuery(undefined, { refetchInterval: 60_000, refetchOnWindowFocus: true });
  const cleanup = trpc.auth.admin.dashboard.cleanupExpiredSnapshots.useMutation({
    onSuccess: result => {
      setStatus(result.deleted > 0 ? `أُزيلت ${formatValue(result.deleted, 0)} لقطة منتهية بأمان.` : "لا توجد لقطات مؤهلة للتنظيف الآن.");
      void utils.auth.admin.dashboard.overview.invalidate();
    },
    onError: error => setStatus(error.message),
  });
  const [status, setStatus] = useState<string | null>(null);
  const data = overview.data;
  const checkedAt = data?.checkedAt ? new Date(data.checkedAt).toLocaleString("ar", { dateStyle: "short", timeStyle: "short" }) : null;
  const refresh = () => {
    setStatus(null);
    void overview.refetch();
  };

  return (
    <section className="space-y-4" aria-label="لوحة العمليات الإدارية">
      <div className="flex flex-col gap-3 min-[500px]:flex-row min-[500px]:items-end min-[500px]:justify-between">
        <div>
          <div className="flex items-center gap-2"><Activity className="size-4 text-primary" /><h2 className="text-lg font-semibold">نظرة تشغيلية</h2></div>
          <p className="mt-1 text-sm text-muted-foreground">ملخص آني محدود يساعدك في متابعة الاستخدام والكاش وتهيئة الخدمات، دون عرض أسرار أو سجلات المستخدمين الخاصة.</p>
        </div>
        <Button type="button" size="sm" variant="outline" className="min-h-10 border-white/10 bg-white/[0.03]" onClick={refresh} disabled={overview.isFetching}>
          <RefreshCw className={`ml-1.5 size-4 ${overview.isFetching ? "animate-spin" : ""}`} />تحديث الحالة
        </Button>
      </div>

      {overview.isLoading ? <Panel className="flex min-h-32 items-center justify-center text-sm text-muted-foreground"><RefreshCw className="ml-2 size-4 animate-spin" />جارٍ تحميل مؤشرات العمليات…</Panel> : overview.error ? <Panel className="border-rose-400/25 bg-rose-400/[0.05]"><p className="text-sm text-rose-200">تعذر تحميل الملخص التشغيلي: {overview.error.message}</p></Panel> : data ? <>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <MetricCard label="إجمالي المستخدمين" value={formatValue(data.users.total, 0)} detail={`${formatValue(data.users.activeLast7Days, 0)} نشطون خلال 7 أيام`} icon={<UsersRound className="size-4 text-sky-300" />} />
          <MetricCard label="الحسابات الإدارية" value={formatValue(data.users.admins, 0)} detail="صلاحيات التحكم محصورة بالحسابات الإدارية" icon={<ShieldCheck className="size-4 text-emerald-300" />} positive />
          <MetricCard label="المراكز الورقية المفتوحة" value={formatValue(data.paperTrading.openTrades, 0)} detail="متابعة تشغيلية، وليست تنفيذًا فعليًا" icon={<WalletCards className="size-4 text-violet-300" />} />
          <MetricCard label="لقطات الكاش" value={formatValue(data.marketCache.cachedSnapshots, 0)} detail={`${formatValue(data.marketCache.cleanupEligibleSnapshots, 0)} مؤهلة للتنظيف`} icon={<DatabaseZap className="size-4 text-amber-200" />} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
          <Panel className="p-4">
            <div className="flex items-start justify-between gap-3"><div><p className="text-sm font-semibold">ضوابط الخدمات</p><p className="mt-1 text-xs leading-5 text-muted-foreground">حالات التهيئة التي يمكن مراجعتها من دون كشف المفاتيح أو بيانات الحسابات.</p></div><Badge variant="outline" className="border-white/10 bg-white/[0.03]">آخر تحديث: {checkedAt ?? "—"}</Badge></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Bot className="size-3.5 text-primary" />المساعد الذكي</div><p className="mt-2 text-sm font-medium text-foreground">{data.ai.activeProvider ? `${data.ai.activeProvider.provider} · ${data.ai.activeProvider.model}` : "لا يوجد مزود نشط"}</p><p className="mt-1 text-[11px] text-muted-foreground">{formatValue(data.ai.configuredProviders, 0)} مزود/مزودات بمفتاح محفوظ</p></div>
              <div className="rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div className="flex items-center gap-2 text-xs text-muted-foreground"><DatabaseZap className="size-3.5 text-primary" />تنظيف اللقطات</div><p className="mt-2 text-sm font-medium text-foreground">{data.cleanup.registered ? "مهمة مجدولة مسجلة" : "لا توجد مهمة مسجلة"}</p><p className="mt-1 text-[11px] text-muted-foreground">التنظيف التلقائي يحذف الكاش المنتهي منذ أكثر من يوم فقط.</p></div>
            </div>
          </Panel>

          <Panel className="border-amber-300/15 bg-gradient-to-br from-amber-300/[0.07] to-transparent p-4">
            <div className="flex items-start gap-3"><span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-300/10 text-amber-200"><Trash2 className="size-4" /></span><div className="min-w-0"><p className="text-sm font-semibold">تنظيف كاش السوق المنتهي</p><p className="mt-1 text-xs leading-5 text-muted-foreground">إجراء يدوي محدود يحذف لقطات الكاش المنتهية منذ أكثر من 24 ساعة فقط. لا يمس الصفقات أو الإشارات أو حسابات المستخدمين.</p></div></div>
            <AlertDialog>
              <AlertDialogTrigger asChild><Button type="button" size="sm" variant="outline" className="mt-4 min-h-10 border-amber-300/30 text-amber-100 hover:bg-amber-300/10" disabled={cleanup.isPending}><Trash2 className="ml-1.5 size-4" />{cleanup.isPending ? "جارٍ التنظيف…" : "تنظيف اللقطات المنتهية"}</Button></AlertDialogTrigger>
              <AlertDialogContent dir="rtl"><AlertDialogHeader><AlertDialogTitle>تأكيد تنظيف كاش السوق</AlertDialogTitle><AlertDialogDescription>سيُحذف فقط كاش السوق المنتهي منذ أكثر من 24 ساعة. لن تتأثر الصفقات الورقية أو الإشارات أو بيانات المستخدمين.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>إلغاء</AlertDialogCancel><AlertDialogAction onClick={() => cleanup.mutate()}>تنفيذ تنظيف آمن</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
            </AlertDialog>
          </Panel>
        </div>
      </> : null}
      {status ? <p role="status" className={`text-xs ${status.startsWith("أُزيلت") || status.startsWith("لا توجد") ? "text-emerald-300" : "text-destructive"}`}>{status}</p> : null}
    </section>
  );
}

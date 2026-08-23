import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, LoadState, Panel, PageHeading, formatValue } from "@/components/market-ui";
import { AdminAiProviderSettings } from "@/components/AdminAiProviderSettings";
import { trpc } from "@/lib/trpc";
import { Bot, Clock3, ShieldCheck } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminUsers() {
  const { user } = useAuth();
  const { data, isLoading, error } = trpc.auth.admin.listUsers.useQuery(undefined, {
    enabled: user?.role === "admin",
  });
  const registerCleanup = trpc.auth.admin.heartbeat.registerMarketSnapshotCleanup.useMutation();

  const rows =
    data?.map(row => ({
      ...row,
      role: row.role === "admin" ? "مسؤول" : "مستخدم",
      lastSignedIn: row.lastSignedIn ? new Date(row.lastSignedIn).toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" }) : "لم يسجّل الدخول بعد",
      loginMethod: row.loginMethod === "password" ? "بريد وكلمة مرور" : (row.loginMethod ?? "—"),
    })) ?? [];

  return (
    <div className="space-y-6">
      <PageHeading
        eyebrow="ADMINISTRATION"
        title="مركز الإدارة"
        description="إدارة مستخدمي AMIC وتكاملات نماذج الذكاء الاصطناعي من مساحة إدارية محمية."
      />

      {user?.role !== "admin" ? (
        <Panel>
          <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
            لا تملك صلاحيات الوصول إلى لوحة الإدارة.
          </div>
        </Panel>
      ) : (
        <div className="space-y-6">
          <AdminAiProviderSettings />
          <Panel>
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
              <div className="flex gap-3">
                <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" />
                <div>
                  <p className="text-sm font-medium text-foreground">تنظيف لقطات السوق المجدول</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">يسجل مهمة Heartbeat ساعةً بساعة مرة واحدة فقط. لا ينفذ الحذف إلا عندما يطابق معرّف المهمة المسجل في قاعدة البيانات.</p>
                  {registerCleanup.data && <p className="mt-2 text-xs text-emerald-300">{registerCleanup.data.created ? "تم تسجيل المهمة بنجاح." : "المهمة مسجلة بالفعل."} المعرف: {registerCleanup.data.taskUid}</p>}
                  {registerCleanup.error && <p className="mt-2 text-xs text-destructive">تعذر تسجيل المهمة: {registerCleanup.error.message}</p>}
                </div>
              </div>
              <Button onClick={() => registerCleanup.mutate()} disabled={registerCleanup.isPending}>
                {registerCleanup.isPending ? "جارٍ التسجيل…" : "تسجيل مهمة التنظيف"}
              </Button>
            </div>
          </Panel>
          <LoadState loading={isLoading} error={error}>
            <Panel>
              <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
                <ShieldCheck className="size-4 text-primary" />
                المستخدمون المسجّلون ({formatValue(rows.length, 0)})
              </div>
              <DataTable rows={rows as never[]} />
              <div className="mt-4 flex flex-wrap gap-2">
                <Badge variant="outline" className="border-emerald-400/25 bg-emerald-400/10 text-emerald-300">مسؤول: صلاحيات كاملة تشمل إدارة المستخدمين وإعدادات الذكاء الاصطناعي</Badge>
                <Badge variant="outline" className="border-slate-300/15 bg-slate-300/10 text-slate-300">مستخدم: وصول عادي إلى أدوات التحليل والتداول الورقي</Badge>
              </div>
            </Panel>
          </LoadState>
        </div>
      )}

      {user?.role === "admin" && (
        <Panel className="border-dashed">
          <div className="flex gap-3"><Bot className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-xs leading-6 text-muted-foreground">مفاتيح مزودي الذكاء الاصطناعي تُخزّن مشفّرة ولا تظهر مجددًا بعد الحفظ. عند اختيار مزود نشط، يستعمله مساعد AMIC تلقائيًا. ترقية مستخدم إلى مسؤول تتم من قاعدة البيانات فقط.</p></div>
        </Panel>
      )}
    </div>
  );
}

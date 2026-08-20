import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DataTable, LoadState, Panel, PageHeading, formatValue } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";

export default function AdminUsers() {
  const { user } = useAuth();
  const { data, isLoading, error } = trpc.auth.admin.listUsers.useQuery(undefined, {
    enabled: user?.role === "admin",
  });

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
        title="إدارة المستخدمين"
        description="قائمة مستخدمي منصة AMIC وأدوارهم وآخر وقت تسجيل دخول لكل منهم. الإدارة متاحة لحساب المسؤول فقط."
      />

      {user?.role !== "admin" ? (
        <Panel>
          <div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">
            لا تملك صلاحيات الوصول إلى لوحة الإدارة.
          </div>
        </Panel>
      ) : (
        <LoadState loading={isLoading} error={error}>
          <Panel>
            <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground">
              <ShieldCheck className="size-4 text-primary" />
              المستخدمون المسجّلون ({formatValue(rows.length, 0)})
            </div>
            <DataTable rows={rows as never[]} />
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="outline" className="border-emerald-400/25 bg-emerald-400/10 text-emerald-300">
                مسؤول: صلاحيات كاملة تشمل إدارة المستخدمين
              </Badge>
              <Badge variant="outline" className="border-slate-300/15 bg-slate-300/10 text-slate-300">
                مستخدم: وصول عادي إلى أدوات التحليل والتداول الورقي
              </Badge>
            </div>
          </Panel>
        </LoadState>
      )}

      {user?.role === "admin" && (
        <Panel className="border-dashed">
          <p className="text-xs leading-6 text-muted-foreground">
            ترقية مستخدم إلى مسؤول تتم بتعديل حقل الدور في قاعدة البيانات مباشرة. جميع البيانات معزولة لكل مستخدم ولا يشارك المستخدمون الإشارات أو الصفقات الورقية فيما بينهم.
          </p>
        </Panel>
      )}
    </div>
  );
}

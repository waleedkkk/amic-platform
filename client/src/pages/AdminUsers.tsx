import { AdminAiProviderSettings } from "@/components/AdminAiProviderSettings";
import { AdminOperationsDashboard } from "@/components/AdminOperationsDashboard";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, LoadState, Panel, PageHeading, formatValue } from "@/components/market-ui";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { ADMIN_TABS, type AdminTabValue } from "./adminTabs";
import { Bot, Clock3, DatabaseZap, LayoutDashboard, Search, Settings2, ShieldCheck, UsersRound } from "lucide-react";
import { useMemo, useState, type ComponentType } from "react";

const tabIcons: Record<AdminTabValue, ComponentType<{ className?: string }>> = {
  overview: LayoutDashboard,
  users: UsersRound,
  ai: Bot,
  maintenance: DatabaseZap,
};

export default function AdminUsers() {
  const { user } = useAuth();
  const { data, isLoading, error } = trpc.auth.admin.listUsers.useQuery(undefined, { enabled: user?.role === "admin" });
  const registerCleanup = trpc.auth.admin.heartbeat.registerMarketSnapshotCleanup.useMutation();
  const [userSearch, setUserSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | "admin" | "user">("all");

  const rows = useMemo(() => {
    const search = userSearch.trim().toLowerCase();
    return (data ?? [])
      .filter(row => roleFilter === "all" || row.role === roleFilter)
      .filter(row => !search || `${row.name ?? ""} ${row.email ?? ""}`.toLowerCase().includes(search))
      .map(row => {
        const lastSignedIn = row.lastSignedIn ? new Date(row.lastSignedIn) : null;
        const activeRecently = Boolean(lastSignedIn && lastSignedIn.getTime() > Date.now() - 7 * 24 * 60 * 60 * 1_000);
        return {
          المستخدم: row.name ?? "—",
          البريد: row.email ?? "—",
          الصلاحية: row.role === "admin" ? "مسؤول" : "مستخدم",
          النشاط: activeRecently ? "نشط مؤخرًا" : "غير نشط مؤخرًا",
          "آخر دخول": lastSignedIn ? lastSignedIn.toLocaleString("ar", { dateStyle: "medium", timeStyle: "short" }) : "لم يسجّل الدخول بعد",
          "طريقة الدخول": row.loginMethod === "password" ? "بريد وكلمة مرور" : (row.loginMethod ?? "—"),
        };
      });
  }, [data, roleFilter, userSearch]);

  return (
    <div className="space-y-6">
      <PageHeading eyebrow="ADMINISTRATION" title="مركز الإدارة" description="إدارة المستخدمين والخدمات وكاش السوق من مساحة إدارية محمية ومنظمة." />

      {user?.role !== "admin" ? <Panel><div className="flex min-h-40 items-center justify-center gap-3 text-sm text-muted-foreground">لا تملك صلاحيات الوصول إلى لوحة الإدارة.</div></Panel> : (
        <Tabs defaultValue="overview" dir="rtl" className="space-y-5">
          <div className="rounded-2xl border border-border/70 bg-card/70 p-1.5 shadow-sm">
            <TabsList aria-label="أقسام مركز الإدارة" className="h-auto w-full justify-start gap-1 overflow-x-auto rounded-xl bg-muted/50 p-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {ADMIN_TABS.map(tab => {
                const Icon = tabIcons[tab.value];
                return <TabsTrigger key={tab.value} value={tab.value} className="min-h-11 min-w-[8.5rem] shrink-0 px-3 text-xs text-muted-foreground data-[state=active]:bg-background data-[state=active]:text-foreground sm:min-w-[9.5rem] sm:text-sm"><Icon className="size-4" />{tab.label}</TabsTrigger>;
              })}
            </TabsList>
            <p className="px-3 pb-1 pt-2 text-xs text-muted-foreground">اسحب أفقيًا على الهاتف لاستعراض الأقسام؛ التبويبات تدعم لوحة المفاتيح وحلقة تركيز ظاهرة.</p>
          </div>

          <TabsContent value="overview" className="mt-0 space-y-4 focus-visible:ring-2 focus-visible:ring-ring/60"><AdminOperationsDashboard view="overview" /></TabsContent>

          <TabsContent value="users" className="mt-0 focus-visible:ring-2 focus-visible:ring-ring/60">
            <LoadState loading={isLoading} error={error}>
              <Panel>
                <div className="mb-4 flex items-center gap-2 text-sm font-medium text-foreground"><UsersRound className="size-4 text-primary" />المستخدمون المسجّلون ({formatValue(rows.length, 0)})</div>
                <div className="mb-4 grid gap-2 sm:grid-cols-[1fr_11rem]"><div className="relative"><Search className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" /><Input aria-label="البحث في المستخدمين" value={userSearch} onChange={event => setUserSearch(event.target.value)} placeholder="ابحث بالاسم أو البريد…" className="h-11 border-border/70 bg-muted/30 pr-9" /></div><Select value={roleFilter} onValueChange={value => setRoleFilter(value as "all" | "admin" | "user")}><SelectTrigger aria-label="تصفية المستخدمين حسب الصلاحية" className="h-11 border-border/70 bg-muted/30"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">كل الصلاحيات</SelectItem><SelectItem value="admin">المسؤولون</SelectItem><SelectItem value="user">المستخدمون</SelectItem></SelectContent></Select></div>
                <DataTable rows={rows as never[]} />
                <div className="mt-4 flex flex-wrap gap-2"><Badge variant="outline" className="border-emerald-400/25 bg-emerald-400/10 text-emerald-300">مسؤول: صلاحيات كاملة تشمل إدارة المستخدمين وإعدادات الذكاء الاصطناعي</Badge><Badge variant="outline" className="border-slate-300/15 bg-slate-300/10 text-slate-300">مستخدم: وصول عادي إلى أدوات التحليل والتداول الورقي</Badge></div>
              </Panel>
            </LoadState>
          </TabsContent>

          <TabsContent value="ai" className="mt-0 space-y-4 focus-visible:ring-2 focus-visible:ring-ring/60">
            <AdminAiProviderSettings />
            <Panel className="border-dashed"><div className="flex gap-3"><Settings2 className="mt-0.5 size-4 shrink-0 text-primary" /><p className="text-xs leading-6 text-muted-foreground">مفاتيح مزودي الذكاء الاصطناعي تُخزّن مشفّرة ولا تظهر مجددًا بعد الحفظ. عند اختيار مزود نشط، يستعمله مساعد AMIC تلقائيًا. ترقية مستخدم إلى مسؤول تتم من قاعدة البيانات فقط.</p></div></Panel>
          </TabsContent>

          <TabsContent value="maintenance" className="mt-0 space-y-4 focus-visible:ring-2 focus-visible:ring-ring/60">
            <AdminOperationsDashboard view="maintenance" />
            <Panel><div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center"><div className="flex gap-3"><Clock3 className="mt-0.5 size-4 shrink-0 text-primary" /><div><p className="text-sm font-medium text-foreground">تنظيف لقطات السوق المجدول</p><p className="mt-1 text-xs leading-5 text-muted-foreground">يسجل مهمة Heartbeat ساعةً بساعة مرة واحدة فقط. لا ينفذ الحذف إلا عندما يطابق معرّف المهمة المسجل في قاعدة البيانات.</p>{registerCleanup.data && <p className="mt-2 text-xs text-emerald-300">{registerCleanup.data.created ? "تم تسجيل المهمة بنجاح." : "المهمة مسجلة بالفعل."} المعرف: {registerCleanup.data.taskUid}</p>}{registerCleanup.error && <p className="mt-2 text-xs text-destructive">تعذر تسجيل المهمة: {registerCleanup.error.message}</p>}</div></div><Button className="min-h-11" onClick={() => registerCleanup.mutate()} disabled={registerCleanup.isPending}>{registerCleanup.isPending ? "جارٍ التسجيل…" : "تسجيل مهمة التنظيف"}</Button></div></Panel>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

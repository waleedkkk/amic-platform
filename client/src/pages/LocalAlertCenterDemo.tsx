import { LocalAlertCenterPreview } from "./AlertCenter";
import { LOCAL_ALERT_DEMO_ACCOUNT } from "@/lib/alertCenterDemo";
import { FlaskConical, MonitorCog } from "lucide-react";

export default function LocalAlertCenterDemo() {
  return <div className="surface-grid min-h-screen bg-background" dir="rtl"><div className="mx-auto min-h-screen max-w-[1600px] p-3 sm:p-6 lg:p-8"><header className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-amber-400/20 bg-amber-400/[0.055] p-4"><div className="flex items-center gap-3"><span className="flex size-10 items-center justify-center rounded-xl bg-amber-400/10 text-amber-200"><FlaskConical className="size-5" /></span><div><p className="font-semibold">بيئة معاينة محلية</p><p className="mt-1 text-xs text-muted-foreground">تعمل على بيانات افتراضية داخل المتصفح ولا تتصل بقاعدة البيانات أو أي مزود سوق.</p></div></div><div className="rounded-xl border border-white/[0.08] bg-black/15 px-3 py-2 text-left"><div className="flex items-center gap-2 text-xs font-medium"><MonitorCog className="size-3.5 text-primary" />{LOCAL_ALERT_DEMO_ACCOUNT.name}</div><p className="mt-1 text-[11px] text-muted-foreground" dir="ltr">{LOCAL_ALERT_DEMO_ACCOUNT.email}</p></div></header><LocalAlertCenterPreview /></div></div>;
}

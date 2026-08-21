import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import { Bell, BellRing, Check, MessageCircle, Plus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type MetalAlertSettingsProps = {
  metal: "XAUUSD" | "XAGUSD";
  label: string;
  currentPrice: number;
  precision: number;
};

function arabicPrice(value: string | number, precision = 2) {
  const price = Number(value);
  return Number.isFinite(price) ? price.toLocaleString("ar", { minimumFractionDigits: precision, maximumFractionDigits: precision }) : String(value);
}

export function MetalAlertSettings({ metal, label, currentPrice, precision }: MetalAlertSettingsProps) {
  const utils = trpc.useUtils();
  const alerts = trpc.metalAlerts.list.useQuery();
  const notifications = trpc.metalAlerts.notifications.useQuery();
  const telegram = trpc.metalAlerts.telegram.get.useQuery();
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [targetPrice, setTargetPrice] = useState("");
  const [chatId, setChatId] = useState("");
  const [telegramEnabled, setTelegramEnabled] = useState(false);

  useEffect(() => {
    if (telegram.data) {
      setChatId(telegram.data.chatId);
      setTelegramEnabled(telegram.data.enabled);
    }
  }, [telegram.data]);

  const invalidate = () => {
    void utils.metalAlerts.list.invalidate();
    void utils.metalAlerts.notifications.invalidate();
  };
  const create = trpc.metalAlerts.create.useMutation({
    onSuccess: () => { setTargetPrice(""); invalidate(); toast.success("تم حفظ تنبيه السعر."); },
    onError: error => toast.error(error.message),
  });
  const cancel = trpc.metalAlerts.cancel.useMutation({ onSuccess: invalidate, onError: error => toast.error(error.message) });
  const saveTelegram = trpc.metalAlerts.telegram.save.useMutation({
    onSuccess: () => { void utils.metalAlerts.telegram.get.invalidate(); toast.success("تم حفظ إعداد تيليغرام."); },
    onError: error => toast.error(error.message),
  });
  const markRead = trpc.metalAlerts.markNotificationRead.useMutation({ onSuccess: () => void utils.metalAlerts.notifications.invalidate() });

  const metalAlerts = (alerts.data ?? []).filter(alert => alert.metal === metal);
  const unreadNotifications = (notifications.data ?? []).filter(item => !item.readAt);
  const submitAlert = () => {
    if (!targetPrice.trim()) return toast.error("أدخل مستوى السعر المطلوب.");
    create.mutate({ metal, direction, targetPrice: targetPrice.trim() });
  };

  return <section className="rounded-2xl border border-amber-300/15 bg-amber-300/[0.035] p-4 sm:p-5" aria-labelledby={`alerts-${metal}`}>
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 id={`alerts-${metal}`} className="flex items-center gap-2 text-base font-semibold"><Bell className="size-4 text-amber-200" />تنبيهات {label}</h3>
        <p className="mt-1 text-xs leading-5 text-muted-foreground">اختر مستوى سعريًا؛ يُطلق التنبيه مرة واحدة عند التحقق ويظهر داخل AMIC.</p>
      </div>
      {unreadNotifications.length > 0 ? <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-2.5 py-1 text-xs font-medium text-primary"><BellRing className="size-3.5" />{unreadNotifications.length} جديد</span> : null}
    </div>

    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
      <select value={direction} onChange={event => setDirection(event.target.value as "above" | "below")} className="min-h-10 rounded-lg border border-white/[0.1] bg-black/20 px-3 text-sm outline-none focus:ring-2 focus:ring-primary">
        <option value="above">يتجاوز السعر صعودًا</option>
        <option value="below">يهبط إلى أو دون</option>
      </select>
      <Input inputMode="decimal" value={targetPrice} onChange={event => setTargetPrice(event.target.value)} placeholder={`السعر الحالي ${arabicPrice(currentPrice, precision)}`} aria-label={`مستوى سعر تنبيه ${label}`} className="min-h-10 bg-black/20" />
      <Button type="button" onClick={submitAlert} disabled={create.isPending} className="min-h-10 gap-1.5"><Plus className="size-4" />إضافة تنبيه</Button>
    </div>

    <div className="mt-4 space-y-2">
      {metalAlerts.length === 0 ? <p className="rounded-lg border border-dashed border-white/[0.1] px-3 py-3 text-xs text-muted-foreground">لا توجد تنبيهات {label} محفوظة بعد.</p> : metalAlerts.map(alert => <div key={alert.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-white/[0.08] bg-black/10 px-3 py-2.5 text-sm">
        <span>{alert.direction === "above" ? "يتجاوز" : "يهبط إلى"} <strong>{arabicPrice(alert.targetPrice, precision)}</strong> دولار</span>
        {alert.status === "active" ? <Button type="button" size="sm" variant="ghost" onClick={() => cancel.mutate({ id: alert.id })} disabled={cancel.isPending} className="h-8 gap-1 text-muted-foreground hover:text-rose-300"><Trash2 className="size-3.5" />إلغاء</Button> : <span className={`rounded-md px-2 py-1 text-xs ${alert.status === "triggered" ? "bg-emerald-400/10 text-emerald-300" : "bg-white/[0.06] text-muted-foreground"}`}>{alert.status === "triggered" ? "تم الإطلاق" : "ملغى"}</span>}
      </div>)}
    </div>

    <div className="mt-5 border-t border-white/[0.08] pt-4">
      <div className="flex items-start gap-2"><MessageCircle className="mt-0.5 size-4 shrink-0 text-sky-300" /><div><p className="text-sm font-medium">إرسال إلى تيليغرام</p><p className="mt-0.5 text-xs leading-5 text-muted-foreground">يمكنك تشغيل نسخ التنبيه إلى محادثتك بعد أن ترسل <strong>/start</strong> إلى بوت AMIC وتدخل معرّف المحادثة.</p></div></div>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={chatId} onChange={event => setChatId(event.target.value)} placeholder="معرّف المحادثة في تيليغرام" aria-label="معرّف محادثة تيليغرام" className="min-h-10 bg-black/20" /><Button type="button" variant={telegramEnabled ? "default" : "outline"} onClick={() => saveTelegram.mutate({ enabled: !telegramEnabled, chatId })} disabled={saveTelegram.isPending} className="min-h-10 shrink-0 gap-1.5">{telegramEnabled ? <><Check className="size-4" />مفعّل</> : <><MessageCircle className="size-4" />تفعيل تيليغرام</>}</Button></div>
    </div>

    {unreadNotifications.length > 0 ? <div className="mt-5 space-y-2 border-t border-white/[0.08] pt-4"><p className="text-sm font-medium">إشعارات حديثة</p>{unreadNotifications.slice(0, 3).map(item => <button key={item.id} type="button" onClick={() => markRead.mutate({ id: item.id })} className="block w-full rounded-lg border border-primary/15 bg-primary/[0.05] px-3 py-2 text-right text-xs leading-5 transition-colors hover:bg-primary/[0.1]"><strong className="block text-foreground">{item.title}</strong><span className="text-muted-foreground">{item.content}</span></button>)}</div> : null}
  </section>;
}

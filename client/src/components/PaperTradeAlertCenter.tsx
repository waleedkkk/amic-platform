import { Bell, CheckCheck, CircleAlert, CircleCheck, Wifi, WifiOff, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { PaperTradeAlert, PaperTradeSocketStatus } from "@/hooks/usePaperTradeAlerts";

function statusLabel(status: PaperTradeSocketStatus) {
  if (status === "connected") return "التنبيهات الفورية متصلة";
  if (status === "reconnecting") return "إعادة الاتصال بالتنبيهات…";
  if (status === "offline") return "التنبيهات الفورية غير متاحة";
  return "جارٍ الاتصال بالتنبيهات…";
}

function alertTitle(alert: PaperTradeAlert) {
  return alert.type === "paper_trade.close_deviation_detected"
    ? "تحذير انحراف سعري"
    : "تم إغلاق الصفقة الورقية";
}

function alertDescription(alert: PaperTradeAlert) {
  if (alert.type === "paper_trade.close_deviation_detected") {
    return `سعر إغلاق ${alert.symbol} يبعد ${alert.deviationPercent?.toFixed(2) ?? "—"}% عن السعر المرجعي.`;
  }
  return `تم تحديث حالة صفقة ${alert.symbol} وإغلاقها في حسابك.`;
}

export function PaperTradeAlertCenter({
  alerts,
  status,
  onDismiss,
  onClear,
  onSelect,
}: {
  alerts: PaperTradeAlert[];
  status: PaperTradeSocketStatus;
  onDismiss: (eventId: string) => void;
  onClear: () => void;
  onSelect: (alert: PaperTradeAlert) => void;
}) {
  const unreadCount = alerts.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="min-h-11 w-full justify-center gap-2 bg-white/[0.03] sm:w-auto"
          aria-label={`مركز التنبيهات، ${unreadCount} تنبيه`}
        >
          <span className="relative">
            <Bell className="size-4" />
            {unreadCount > 0 ? (
              <span className="absolute -right-2 -top-2 flex size-4 items-center justify-center rounded-full bg-amber-400 text-[10px] font-bold text-slate-950">
                {unreadCount > 9 ? "9+" : unreadCount}
              </span>
            ) : null}
          </span>
          <span>التنبيهات</span>
          <span className="sr-only">{statusLabel(status)}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,380px)] p-0" dir="rtl">
        <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
          <div>
            <p className="font-semibold">مركز تنبيهات الصفقات</p>
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-muted-foreground">
              {status === "connected" ? <Wifi className="size-3 text-emerald-300" /> : <WifiOff className="size-3 text-amber-300" />}
              {statusLabel(status)}
            </p>
          </div>
          {alerts.length ? (
            <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={onClear}>
              <CheckCheck className="size-3.5" /> مسح
            </Button>
          ) : null}
        </div>

        <div className="max-h-[min(60vh,460px)] overflow-y-auto p-2">
          {alerts.length ? alerts.map(alert => (
            <article key={alert.eventId} className="group rounded-xl p-3 transition-colors hover:bg-accent/50">
              <div className="flex items-start gap-3">
                {alert.type === "paper_trade.close_deviation_detected" ? (
                  <CircleAlert className="mt-0.5 size-4 shrink-0 text-amber-300" />
                ) : (
                  <CircleCheck className="mt-0.5 size-4 shrink-0 text-emerald-300" />
                )}
                <button type="button" className="min-w-0 flex-1 text-right" onClick={() => onSelect(alert)}>
                  <p className="text-sm font-medium">{alertTitle(alert)}</p>
                  <p className="mt-1 text-xs leading-5 text-muted-foreground">{alertDescription(alert)}</p>
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground/80">
                    {new Date(alert.observedAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="size-7 shrink-0 opacity-70 hover:opacity-100"
                  aria-label="إزالة التنبيه"
                  onClick={() => onDismiss(alert.eventId)}
                >
                  <X className="size-3.5" />
                </Button>
              </div>
            </article>
          )) : (
            <div className="px-3 py-8 text-center text-sm text-muted-foreground">
              لا توجد تنبيهات فورية جديدة.
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

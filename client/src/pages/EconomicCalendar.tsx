import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { PageHeading, Panel } from "@/components/market-ui";
import { DailyMarketDigestPanel } from "@/components/DailyMarketDigestPanel";
import { useI18n } from "@/lib/i18n";
import { trpc } from "@/lib/trpc";
import { BellRing, CalendarDays, ExternalLink, Send } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export default function EconomicCalendar() {
  const { t } = useI18n();
  const utils = trpc.useUtils();
  const calendar = trpc.economicCalendar.upcoming.useQuery(undefined, { refetchOnWindowFocus: false, staleTime: 55 * 60_000 });
  const subscription = trpc.economicCalendar.subscription.get.useQuery();
  const telegram = trpc.metalAlerts.telegram.get.useQuery();
  const [enabled, setEnabled] = useState(false);
  const [chatId, setChatId] = useState("");
  useEffect(() => { if (subscription.data) setEnabled(subscription.data.enabled); }, [subscription.data]);
  useEffect(() => { if (telegram.data) setChatId(telegram.data.chatId); }, [telegram.data]);
  const saveSubscription = trpc.economicCalendar.subscription.save.useMutation({ onSuccess: () => { toast.success("حُفظ اشتراك التقويم الاقتصادي."); utils.economicCalendar.subscription.get.invalidate(); }, onError: error => toast.error(error.message) });
  const saveTelegram = trpc.metalAlerts.telegram.save.useMutation({ onSuccess: () => { toast.success("حُفظت إعدادات تيليغرام."); utils.metalAlerts.telegram.get.invalidate(); }, onError: error => toast.error(error.message) });

  return <><PageHeading eyebrow={t("calendarEyebrow")} title={t("calendarTitle")} description={t("calendarDescription")} />
    <div className="grid gap-4 lg:grid-cols-[1.35fr_0.65fr]"><Panel><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-semibold tracking-[0.13em] text-primary">{t("calendarEyebrow")}</p><h2 className="mt-2 text-xl font-semibold">{t("calendarUpcoming")}</h2><p className="mt-1 text-xs leading-5 text-muted-foreground">{calendar.data?.coverage ?? t("calendarCoverageLoading")}</p></div><CalendarDays className="size-5 text-primary" /></div>{calendar.isLoading ? <p className="mt-6 text-sm text-muted-foreground">{t("calendarLoading")}</p> : calendar.isError ? <p className="mt-6 text-sm text-destructive">{t("calendarError")}</p> : <div className="mt-5 divide-y divide-white/[0.07]">{calendar.data?.events.length ? calendar.data.events.slice(0, 30).map(event => <article className="py-4 first:pt-0" key={event.id}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="flex flex-wrap items-center gap-2"><h3 className="font-medium">{event.title}</h3><span className={`rounded-md px-2 py-0.5 text-[11px] ${event.importance === "high" ? "bg-rose-400/15 text-rose-200" : "bg-sky-400/12 text-sky-200"}`}>{event.importance === "high" ? t("calendarHigh") : t("calendarMedium")}</span></div><p className="mt-1 text-xs text-muted-foreground">{event.country} · {event.source}</p></div><time className="text-left font-mono text-xs text-muted-foreground" dir="ltr">{event.timeKnown ? new Date(event.startsAt).toLocaleString() : new Date(event.startsAt).toLocaleDateString()}</time></div><a href={event.sourceUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline">{t("calendarSource")} <ExternalLink className="size-3" /></a></article>) : <p className="py-6 text-sm text-muted-foreground">{t("calendarNoEvents")}</p>}</div>}</Panel>
      <Panel><BellRing className="size-5 text-primary" /><h2 className="mt-4 text-xl font-semibold">{t("calendarTelegramTitle")}</h2><p className="mt-2 text-sm leading-6 text-muted-foreground">{t("calendarTelegramDescription")}</p><div className="mt-5 flex items-center justify-between rounded-xl border border-white/[0.08] bg-white/[0.025] p-3"><div><p className="text-sm font-medium">{t("calendarEnable")}</p><p className="mt-1 text-xs text-muted-foreground">{t("calendarCountry")}</p></div><Button size="sm" variant={enabled ? "default" : "outline"} onClick={() => setEnabled(value => !value)}>{enabled ? t("calendarEnabled") : t("calendarDisabled")}</Button></div><div className="mt-4"><Label>{t("calendarChatId")}</Label><Input dir="ltr" value={chatId} onChange={event => setChatId(event.target.value)} className="mt-2 bg-white/[0.025]" placeholder="123456789" /></div><p className="mt-2 text-[11px] leading-5 text-muted-foreground">{telegram.data?.botConfigured ? t("calendarBotReady") : t("calendarBotMissing")}</p><div className="mt-5 grid gap-2"><Button disabled={saveSubscription.isPending} onClick={() => saveSubscription.mutate({ enabled, highImpactOnly: true, countries: ["United States"], preAlertMinutes: 60 })}><BellRing className="ml-2 size-4" />{t("calendarSave")}</Button><Button variant="outline" className="bg-white/[0.03]" disabled={saveTelegram.isPending} onClick={() => saveTelegram.mutate({ enabled: Boolean(chatId.trim()), chatId })}><Send className="ml-2 size-4" />{t("calendarSaveTelegram")}</Button></div><DailyMarketDigestPanel /></Panel></div>
  </>;
}

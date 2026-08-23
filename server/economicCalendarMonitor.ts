import { fetchOfficialEconomicCalendar, type OfficialEconomicEvent } from "../shared/economicCalendar";
import { listActiveEconomicCalendarSubscriptions, recordEconomicCalendarDelivery } from "./db";
import { ENV } from "./_core/env";

const REMINDER_WINDOW_MS = 5 * 60_000;

export function selectEventsForPreAlert(events: OfficialEconomicEvent[], now: Date, preAlertMinutes: number) {
  const target = now.getTime() + preAlertMinutes * 60_000;
  return events.filter(event => event.timeKnown && event.importance === "high" && Math.abs(new Date(event.startsAt).getTime() - target) <= REMINDER_WINDOW_MS);
}

async function sendTelegramMessage(chatId: string, text: string) {
  if (!ENV.telegramBotToken) return false;
  const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }) });
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
  return true;
}

export async function checkEconomicCalendarPreAlerts(now = new Date()) {
  const [{ events }, subscriptions] = await Promise.all([fetchOfficialEconomicCalendar(now), listActiveEconomicCalendarSubscriptions()]);
  let eligible = 0;
  let telegramDelivered = 0;
  for (const row of subscriptions) {
    if (!row.telegram?.enabled || !row.telegram.chatId) continue;
    const candidates = selectEventsForPreAlert(events, now, row.subscription.preAlertMinutes)
      .filter(event => row.subscription.countries.includes(event.country))
      .filter(event => !row.subscription.highImpactOnly || event.importance === "high");
    eligible += candidates.length;
    for (const event of candidates) {
      try {
        const claimed = await recordEconomicCalendarDelivery(row.subscription.userId, event.id);
        if (!claimed) continue;
        const eventAt = new Date(event.startsAt).toLocaleString("ar", { timeZone: "UTC", dateStyle: "medium", timeStyle: "short" });
        const delivered = await sendTelegramMessage(row.telegram.chatId, `AMIC — تنبيه اقتصادي عالي الأثر\n${event.title}\nالبلد: ${event.country}\nالموعد: ${eventAt} UTC\nالمصدر: ${event.source}`);
        if (delivered) telegramDelivered += 1;
      } catch (error) {
        console.warn("[Economic calendar] Telegram delivery failed", String(error));
      }
    }
  }
  return { subscriptions: subscriptions.length, eligible, telegramDelivered };
}

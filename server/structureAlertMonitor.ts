import { analyzeMarketStructure, type StructureEvent } from "../shared/marketStructure";
import { getCandleHistoryCached } from "./candles";
import { createStructureAlertNotification, listActiveStructureAlerts, markStructureAlertTriggered } from "./db";
import { ENV } from "./_core/env";

const EVENT_LABEL: Record<string, string> = {
  breakout: "اختراق مقاومة",
  breakdown: "كسر دعم",
  bullish_reversal: "انعكاس صاعد",
  bearish_reversal: "انعكاس هابط",
};

const EVENT_KIND = {
  breakout: "bullish-breakout",
  breakdown: "bearish-breakdown",
  bullish_reversal: "bullish-reversal",
  bearish_reversal: "bearish-reversal",
} as const;

function toCandleInterval(interval: "5m" | "15m" | "1h" | "4h" | "1d" | "1wk") {
  return interval === "1h" ? "60m" : interval === "4h" ? "60m" : interval;
}

function rangeFor(interval: "5m" | "15m" | "1h" | "4h" | "1d" | "1wk") {
  if (interval === "5m" || interval === "15m") return "5d";
  if (interval === "1h" || interval === "4h") return "1mo";
  return interval === "1wk" ? "2y" : "6mo";
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!ENV.telegramBotToken) return;
  const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, {
    method: "POST", headers: { "content-type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
}

function eventKey(event: StructureEvent) {
  return `${event.kind}:${event.time}:${event.price.toFixed(8)}`;
}

export async function checkActiveStructureAlerts() {
  const activeAlerts = await listActiveStructureAlerts();
  let triggered = 0;
  let telegramDelivered = 0;
  for (const row of activeAlerts) {
    const alert = row.alert;
    try {
      const history = await getCandleHistoryCached(alert.symbol, alert.exchange, toCandleInterval(alert.interval), rangeFor(alert.interval));
      const report = analyzeMarketStructure(history.candles);
      const event = [...report.events].reverse().find(candidate => candidate.kind === EVENT_KIND[alert.eventType]);
      if (!event) continue;
      const qualityScore = Math.min(100, 50 + (event.kind.includes("reversal") ? 20 : 10) + Math.min(report.zones.length, 4) * 5);
      const claimed = await markStructureAlertTriggered(alert.id, { price: event.price.toFixed(8), eventKey: eventKey(event), qualityScore });
      if (!claimed) continue;
      triggered += 1;
      const label = EVENT_LABEL[alert.eventType] ?? alert.eventType;
      const title = `تنبيه بنية السعر: ${label}`;
      const content = `${alert.symbol} على ${alert.interval}: ${label} قرب ${event.price.toFixed(4)}. درجة السياق الأولية ${qualityScore}/100.`;
      await createStructureAlertNotification({ userId: alert.userId, title, content, metadata: { alertId: alert.id, symbol: alert.symbol, exchange: alert.exchange, interval: alert.interval, eventType: alert.eventType, eventKind: event.kind, eventTime: event.time, price: event.price, qualityScore } });
      if (row.telegram?.enabled && row.telegram.chatId && ENV.telegramBotToken) {
        try { await sendTelegramMessage(row.telegram.chatId, `AMIC — ${title}\n${content}`); telegramDelivered += 1; }
        catch (error) { console.warn("[Structure alerts] Telegram delivery failed", String(error)); }
      }
    } catch (error) {
      console.warn(`[Structure alerts] evaluation failed for #${alert.id}`, String(error));
    }
  }
  return { checked: activeAlerts.length, triggered, telegramDelivered };
}

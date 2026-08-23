import { getCandleHistoryCached, type Candle } from "./candles";
import { createStructureContextAlertNotification, listActiveStructureContextAlerts, markStructureContextAlertTriggered } from "./db";
import { ENV } from "./_core/env";

type ContextAlert = {
  id: number;
  userId: number;
  symbol: string;
  exchange: string;
  interval: "5m" | "15m" | "1h" | "4h" | "1d" | "1wk";
  sourceKind: "support" | "resistance" | "demand_zone" | "supply_zone";
  sourceLabel: string;
  referencePrice: string;
  rangeLow: string | null;
  rangeHigh: string | null;
  invalidationPrice: string | null;
  eventType: "approach" | "touch" | "invalidation";
  proximityBps: number;
};

const SOURCE_LABEL: Record<ContextAlert["sourceKind"], string> = {
  support: "دعم",
  resistance: "مقاومة",
  demand_zone: "منطقة طلب",
  supply_zone: "منطقة عرض",
};
const EVENT_LABEL: Record<ContextAlert["eventType"], string> = {
  approach: "اقتراب",
  touch: "لمس",
  invalidation: "إبطال",
};

function toInterval(interval: ContextAlert["interval"]) { return interval === "1h" ? "60m" : interval; }
function rangeFor(interval: ContextAlert["interval"]) {
  if (interval === "5m" || interval === "15m") return "5d";
  if (interval === "1h") return "1mo";
  if (interval === "4h") return "3mo";
  return interval === "1wk" ? "2y" : "6mo";
}

function num(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function evaluateStructureContextAlert(alert: ContextAlert, candle: Pick<Candle, "close" | "high" | "low">) {
  const reference = num(alert.referencePrice);
  if (!reference) return null;
  const low = num(alert.rangeLow) ?? reference;
  const high = num(alert.rangeHigh) ?? reference;
  const rangeLow = Math.min(low, high);
  const rangeHigh = Math.max(low, high);
  const proximity = reference * (alert.proximityBps / 10_000);
  const invalidation = num(alert.invalidationPrice);

  if (alert.eventType === "invalidation") {
    if (!invalidation) return null;
    const downwardInvalidation = alert.sourceKind === "support" || alert.sourceKind === "demand_zone";
    return downwardInvalidation ? candle.close < invalidation : candle.close > invalidation;
  }
  if (alert.eventType === "touch") return candle.low <= rangeHigh && candle.high >= rangeLow;
  return candle.close >= rangeLow - proximity && candle.close <= rangeHigh + proximity;
}

async function sendTelegramMessage(chatId: string, text: string) {
  if (!ENV.telegramBotToken) return;
  const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }) });
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
}

export async function checkActiveStructureContextAlerts() {
  const activeAlerts = await listActiveStructureContextAlerts();
  let triggered = 0;
  let telegramDelivered = 0;
  for (const row of activeAlerts) {
    const alert = row.alert as ContextAlert;
    try {
      const history = await getCandleHistoryCached(alert.symbol, alert.exchange, toInterval(alert.interval), rangeFor(alert.interval));
      const candle = history.candles.at(-1);
      if (!candle || !evaluateStructureContextAlert(alert, candle)) continue;
      const claimed = await markStructureContextAlertTriggered(alert.id, candle.close.toFixed(8));
      if (!claimed) continue;
      triggered += 1;
      const kind = SOURCE_LABEL[alert.sourceKind];
      const event = EVENT_LABEL[alert.eventType];
      const title = `تنبيه سياق: ${event} ${kind}`;
      const content = `${alert.symbol} على ${alert.interval}: ${event} ${kind} «${alert.sourceLabel}» قرب ${candle.close.toFixed(4)}. هذا وصف لحالة سعرية وليس توصية تداول.`;
      await createStructureContextAlertNotification({ userId: alert.userId, title, content, metadata: { alertId: alert.id, symbol: alert.symbol, exchange: alert.exchange, interval: alert.interval, sourceKind: alert.sourceKind, sourceLabel: alert.sourceLabel, eventType: alert.eventType, referencePrice: alert.referencePrice, invalidationPrice: alert.invalidationPrice, triggeredPrice: candle.close } });
      if (row.telegram?.enabled && row.telegram.chatId && ENV.telegramBotToken) {
        try { await sendTelegramMessage(row.telegram.chatId, `AMIC — ${title}\n${content}`); telegramDelivered += 1; }
        catch (error) { console.warn("[Structure context alerts] Telegram delivery failed", String(error)); }
      }
    } catch (error) {
      console.warn(`[Structure context alerts] evaluation failed for #${alert.id}`, String(error));
    }
  }
  return { checked: activeAlerts.length, triggered, telegramDelivered };
}

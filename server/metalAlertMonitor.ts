import Decimal from "decimal.js";
import {
  createMetalAlertNotification,
  listActiveMetalAlerts,
  markMetalAlertTriggered,
} from "./db";
import { getCandleHistoryCached } from "./candles";
import { ENV } from "./_core/env";

const METALS = {
  XAUUSD: { yahooSymbol: "GC=F", label: "الذهب", shortLabel: "XAU" },
  XAGUSD: { yahooSymbol: "SI=F", label: "الفضة", shortLabel: "XAG" },
} as const;

type MetalSymbol = keyof typeof METALS;

async function currentMetalPrice(metal: MetalSymbol): Promise<number> {
  const history = await getCandleHistoryCached(METALS[metal].yahooSymbol, "OZ", "1d", "5d");
  const latestClose = history.candles.at(-1)?.close;
  const price = history.regularMarketPrice ?? latestClose;
  if (!price || !Number.isFinite(price)) throw new Error(`تعذر تحديد السعر الحالي لـ ${metal}`);
  return price;
}

async function sendTelegramMessage(chatId: string, text: string): Promise<void> {
  if (!ENV.telegramBotToken) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
  } finally {
    clearTimeout(timeout);
  }
}

export async function checkActiveMetalAlerts() {
  const activeAlerts = await listActiveMetalAlerts();
  const symbols = Array.from(new Set(activeAlerts.map(row => row.alert.metal))) as MetalSymbol[];
  const prices = new Map<MetalSymbol, number>();
  await Promise.all(symbols.map(async metal => prices.set(metal, await currentMetalPrice(metal))));

  let triggered = 0;
  let telegramDelivered = 0;
  for (const row of activeAlerts) {
    const alert = row.alert;
    const price = prices.get(alert.metal)!;
    const target = new Decimal(alert.targetPrice).toNumber();
    const hit = alert.direction === "above" ? price >= target : price <= target;
    if (!hit) continue;

    // الشرط على status في التحديث يجعل إعادة محاولة الـ Heartbeat آمنة ولا يكرر الإطلاق.
    const claimed = await markMetalAlertTriggered(alert.id, price.toFixed(4));
    if (!claimed) continue;
    triggered += 1;
    const descriptor = alert.direction === "above" ? "تجاوز صعودًا" : "هبط إلى أو دون";
    const title = `تنبيه ${METALS[alert.metal].label}: تحقق المستوى`;
    const content = `${METALS[alert.metal].label} (${METALS[alert.metal].shortLabel}) ${descriptor} ${new Decimal(alert.targetPrice).toFixed(2)} دولار؛ السعر الحالي ${price.toFixed(2)} دولار للأوقية.`;
    await createMetalAlertNotification({
      userId: alert.userId,
      title,
      content,
      metadata: { alertId: alert.id, metal: alert.metal, direction: alert.direction, targetPrice: String(alert.targetPrice), triggeredPrice: price.toFixed(4) },
    });
    if (row.telegram?.enabled && row.telegram.chatId && ENV.telegramBotToken) {
      try {
        await sendTelegramMessage(row.telegram.chatId, `AMIC — ${title}\n${content}`);
        telegramDelivered += 1;
      } catch (error) {
        console.warn("[Metal alerts] Telegram delivery failed", String(error));
      }
    }
  }
  return { checked: activeAlerts.length, triggered, telegramDelivered };
}

import { callTradingViewTool } from "./mcpClient";
import { listActiveDailyMarketDigestSubscriptions, recordEconomicCalendarDelivery } from "./db";
import { ENV } from "./_core/env";

function asRows(value: unknown) { return Array.isArray(value) ? value.filter(row => row && typeof row === "object") as Array<Record<string, unknown>> : []; }
function movers(value: unknown) { return asRows(value).slice(0, 3).map(row => `${String(row.symbol ?? "—")} ${typeof row.changePercent === "number" ? `${row.changePercent >= 0 ? "+" : ""}${row.changePercent.toFixed(2)}%` : ""}`.trim()).join("، ") || "غير متاح"; }
function snapshotLabel(value: unknown) { return value && typeof value === "object" ? JSON.stringify(value).slice(0, 420) : "غير متاح"; }

export async function createDailyMarketDigest() {
  const [snapshot, gainers, losers] = await Promise.allSettled([
    callTradingViewTool("market_snapshot", {}),
    callTradingViewTool("top_gainers", { exchange: "BINANCE", timeframe: "1D", limit: 3 }),
    callTradingViewTool("top_losers", { exchange: "BINANCE", timeframe: "1D", limit: 3 }),
  ]);
  const snapshotValue = snapshot.status === "fulfilled" ? snapshot.value : null;
  const gainersValue = gainers.status === "fulfilled" ? gainers.value : null;
  const losersValue = losers.status === "fulfilled" ? losers.value : null;
  const fetchedAt = new Date().toISOString();
  return {
    fetchedAt,
    snapshot: snapshotValue,
    gainers: asRows(gainersValue),
    losers: asRows(losersValue),
    text: `AMIC — ملخص السوق اليومي\nالرابحون (BINANCE): ${movers(gainersValue)}\nالخاسرون (BINANCE): ${movers(losersValue)}\nلقطة السوق: ${snapshotLabel(snapshotValue)}\nوقت الجلب: ${fetchedAt}\nمعلومات تعليمية وليست توصية تداول.`,
  };
}

async function sendTelegramMessage(chatId: string, text: string) {
  if (!ENV.telegramBotToken) return false;
  const response = await fetch(`https://api.telegram.org/bot${ENV.telegramBotToken}/sendMessage`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }) });
  if (!response.ok) throw new Error(`Telegram HTTP ${response.status}`);
  return true;
}

export async function sendDailyMarketDigests(now = new Date()) {
  const [digest, subscriptions] = await Promise.all([createDailyMarketDigest(), listActiveDailyMarketDigestSubscriptions()]);
  let telegramDelivered = 0;
  const eventId = `daily-market-digest:${now.toISOString().slice(0, 10)}`;
  for (const row of subscriptions) {
    if (!row.telegram?.enabled || !row.telegram.chatId) continue;
    try {
      const claimed = await recordEconomicCalendarDelivery(row.subscription.userId, eventId);
      if (!claimed) continue;
      if (await sendTelegramMessage(row.telegram.chatId, digest.text)) telegramDelivered += 1;
    } catch (error) { console.warn("[Daily market digest] Telegram delivery failed", String(error)); }
  }
  return { subscriptions: subscriptions.length, telegramDelivered, fetchedAt: digest.fetchedAt };
}

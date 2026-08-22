import WebSocket from "ws";
import { tvSymbolToTwelveData } from "./candles";

const TWELVE_STREAM_URL = "wss://ws.twelvedata.com/v1/quotes/price";
const STALE_AFTER_MS = 20_000;
const RECONNECT_BASE_MS = 2_500;
const RECONNECT_MAX_MS = 30_000;

export type LiveProviderStatus = "live" | "connecting" | "reconnecting" | "delayed" | "unavailable";

/** عقد موحد لإبقاء مسار السوق مستقلًا عن مزود البث الفعلي. */
export interface LiveQuoteProvider {
  readonly id: string;
  getQuote(symbol: string, exchange: string): TwelveLiveQuote;
}

export type TwelveLiveQuote = {
  symbol: string;
  price: number | null;
  updatedAt: number | null;
  status: LiveProviderStatus;
};

export function getReconnectDelay(attempt: number): number {
  return Math.min(RECONNECT_BASE_MS * 2 ** Math.max(0, attempt - 1), RECONNECT_MAX_MS);
}

export function resolveLiveProviderStatus(status: Exclude<LiveProviderStatus, "delayed" | "unavailable">, updatedAt: number | null, now = Date.now()): LiveProviderStatus {
  if (status === "connecting" || status === "reconnecting") return status;
  return !updatedAt || now - updatedAt > STALE_AFTER_MS ? "delayed" : "live";
}

export function parseTwelveDataPriceMessage(raw: string): { symbol: string; price: number } | null {
  try {
    const message = JSON.parse(raw) as { symbol?: unknown; price?: unknown };
    const price = Number(message.price);
    if (typeof message.symbol !== "string" || !Number.isFinite(price)) return null;
    return { symbol: message.symbol.toUpperCase(), price };
  } catch {
    return null;
  }
}

type StreamEntry = {
  socket: WebSocket;
  price: number | null;
  updatedAt: number | null;
  status: Exclude<LiveProviderStatus, "delayed" | "unavailable">;
  reconnectAttempt: number;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};
const streams = new Map<string, StreamEntry>();

function streamKey(symbol: string, exchange: string) {
  return `${exchange.toUpperCase()}:${tvSymbolToTwelveData(symbol, exchange).toUpperCase()}`;
}

function openStream(symbol: string, exchange: string, apiKey: string, reconnectAttempt = 0): StreamEntry {
  const providerSymbol = tvSymbolToTwelveData(symbol, exchange);
  const socket = new WebSocket(`${TWELVE_STREAM_URL}?apikey=${encodeURIComponent(apiKey)}`);
  const entry: StreamEntry = {
    socket,
    price: null,
    updatedAt: null,
    status: reconnectAttempt ? "reconnecting" : "connecting",
    reconnectAttempt,
    reconnectTimer: null,
  };
  socket.on("open", () => socket.send(JSON.stringify({ action: "subscribe", params: { symbols: providerSymbol } })));
  socket.on("message", raw => {
    const tick = parseTwelveDataPriceMessage(raw.toString());
    if (!tick || tick.symbol !== providerSymbol.toUpperCase()) return;
    entry.price = tick.price;
    entry.updatedAt = Date.now();
    entry.status = "live";
  });
  socket.on("error", () => socket.close());
  socket.on("close", () => queueReconnect(symbol, exchange, apiKey, entry));
  return entry;
}

function queueReconnect(symbol: string, exchange: string, apiKey: string, entry: StreamEntry) {
  if (entry.reconnectTimer) return;
  const nextAttempt = entry.reconnectAttempt + 1;
  entry.status = "reconnecting";
  entry.reconnectTimer = setTimeout(() => {
    streams.set(streamKey(symbol, exchange), openStream(symbol, exchange, apiKey, nextAttempt));
  }, getReconnectDelay(nextAttempt));
}

/** يفتح اتصالاً خادمياً مشتركاً للرمز عند أول طلب، ثم يعيد آخر سعر فقط للواجهة. */
export function getTwelveDataLiveQuote(symbol: string, exchange: string, apiKey = process.env.TWELVE_DATA_API_KEY): TwelveLiveQuote {
  if (!apiKey) return { symbol, price: null, updatedAt: null, status: "unavailable" };
  const key = streamKey(symbol, exchange);
  const entry = streams.get(key) ?? (() => {
    const created = openStream(symbol, exchange, apiKey);
    streams.set(key, created);
    return created;
  })();
  const status = resolveLiveProviderStatus(entry.status, entry.updatedAt);
  return { symbol, price: status === "live" ? entry.price : null, updatedAt: entry.updatedAt, status };
}

export class TwelveDataStreamProvider implements LiveQuoteProvider {
  readonly id = "twelve-data";
  getQuote(symbol: string, exchange: string) {
    return getTwelveDataLiveQuote(symbol, exchange);
  }
}

export type LiveChartCandle = {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

const binanceIntervals: Record<string, string> = {
  "1m": "1m",
  "5m": "5m",
  "15m": "15m",
  "30m": "30m",
  "60m": "1h",
  "1d": "1d",
  "1wk": "1w",
};

/** يعيد مسار بث شموع Binance للأزواج المتاحة، أو null حين لا يدعم المزود الرمز/الإطار. */
export function getBinanceKlineStream(symbol: string, exchange: string, interval: string): string | null {
  const normalizedSymbol = symbol.trim().toUpperCase();
  const binanceInterval = binanceIntervals[interval];
  if (exchange.trim().toUpperCase() !== "BINANCE" || !binanceInterval || !/^[A-Z0-9]+USDT$/.test(normalizedSymbol)) {
    return null;
  }
  return `wss://stream.binance.com:9443/ws/${normalizedSymbol.toLowerCase()}@kline_${binanceInterval}`;
}

/** يحوّل رسالة kline العامة إلى شمعة قابلة للرسم، ويتجاهل أي payload غير صالح. */
export function parseBinanceKlineMessage(payload: unknown): LiveChartCandle | null {
  let value: unknown = payload;
  if (typeof payload === "string") {
    try {
      value = JSON.parse(payload);
    } catch {
      return null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const kline = (value as { k?: unknown }).k;
  if (!kline || typeof kline !== "object") return null;
  const row = kline as Record<string, unknown>;
  const timeMs = Number(row.t);
  const open = Number(row.o);
  const high = Number(row.h);
  const low = Number(row.l);
  const close = Number(row.c);
  const volume = Number(row.v);
  if (![timeMs, open, high, low, close, volume].every(Number.isFinite)) return null;
  return { time: Math.floor(timeMs / 1000), open, high, low, close, volume };
}

/** يحدّث الشمعة الجارية من البث، أو يضيفها عندما تبدأ فترة جديدة. */
export function mergeLiveCandle<T extends LiveChartCandle>(history: T[], live: LiveChartCandle | null): T[] {
  if (!live) return history;
  const previous = history.at(-1);
  // لا تعرض شمعة البث وحدها: الرسم يحتاج تاريخًا أوليًا لكي لا يبدو كأنه فقد السلسلة.
  if (!previous) return history;
  if (previous.time === live.time) return [...history.slice(0, -1), live as T];
  if (live.time > previous.time) return [...history, live as T];
  return history;
}

import type { Candle } from "./candles";

export type TrackableSignal = {
  id: number;
  symbol: string;
  exchange: string;
  recommendation: "strong_buy" | "buy" | "neutral" | "sell" | "strong_sell";
  createdAt: Date;
};

export type SignalFollowThrough = {
  id: number;
  symbol: string;
  exchange: string;
  recommendation: TrackableSignal["recommendation"];
  status: "successful" | "unfavorable" | "neutral" | "pending" | "unavailable";
  entryPrice: number | null;
  latestPrice: number | null;
  changePercent: number | null;
};

export function assessSignalFollowThrough(signal: TrackableSignal, candles: Candle[]): SignalFollowThrough {
  const base = { id: signal.id, symbol: signal.symbol, exchange: signal.exchange, recommendation: signal.recommendation };
  if (signal.recommendation === "neutral") return { ...base, status: "neutral", entryPrice: null, latestPrice: null, changePercent: null };
  const signalTime = Math.floor(signal.createdAt.getTime() / 1_000);
  const entry = candles.find(candle => candle.time >= signalTime);
  const latest = candles.at(-1);
  if (!entry || !latest || latest.time <= entry.time || entry.close <= 0) return { ...base, status: "pending", entryPrice: entry?.close ?? null, latestPrice: latest?.close ?? null, changePercent: null };
  const changePercent = ((latest.close - entry.close) / entry.close) * 100;
  const expectsRise = signal.recommendation === "buy" || signal.recommendation === "strong_buy";
  const successful = expectsRise ? changePercent > 0 : changePercent < 0;
  return { ...base, status: successful ? "successful" : "unfavorable", entryPrice: entry.close, latestPrice: latest.close, changePercent: Number(changePercent.toFixed(2)) };
}

export function summarizeSignalFollowThrough(results: SignalFollowThrough[]) {
  const measured = results.filter(result => result.status === "successful" || result.status === "unfavorable");
  const successfulSignals = measured.filter(result => result.status === "successful").length;
  return {
    trackedSignals: results.length,
    measuredSignals: measured.length,
    successfulSignals,
    unfavorableSignals: measured.length - successfulSignals,
    pendingSignals: results.filter(result => result.status === "pending").length,
    winRate: measured.length ? Number(((successfulSignals / measured.length) * 100).toFixed(2)) : null,
    samples: results,
  };
}

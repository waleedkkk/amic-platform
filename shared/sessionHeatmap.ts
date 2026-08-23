import { analyzeMarketStructure, type StructureCandle } from "./marketStructure";

export type TradingSession = "asia" | "london" | "newYork";

export const TRADING_SESSION_LABELS: Record<TradingSession, string> = {
  asia: "آسيا",
  london: "لندن",
  newYork: "نيويورك",
};

/** النوافذ بتوقيت UTC: آسيا 21:00–07:59، لندن 08:00–12:59، نيويورك 13:00–20:59. */
export function getTradingSession(timestampSeconds: number): TradingSession {
  const hour = new Date(timestampSeconds * 1_000).getUTCHours();
  if (hour >= 21 || hour < 8) return "asia";
  if (hour < 13) return "london";
  return "newYork";
}

export type SessionHeatmapCell = {
  session: TradingSession;
  candles: number;
  breakouts: number;
  reversals: number;
  events: number;
  eventRate: number;
};

export function calculateSessionHeatmap(candles: StructureCandle[]): SessionHeatmapCell[] {
  const buckets = new Map<TradingSession, SessionHeatmapCell>(Object.keys(TRADING_SESSION_LABELS).map(session => [session as TradingSession, { session: session as TradingSession, candles: 0, breakouts: 0, reversals: 0, events: 0, eventRate: 0 }]));
  for (const candle of candles) buckets.get(getTradingSession(candle.time))!.candles += 1;
  const structure = analyzeMarketStructure(candles);
  for (const event of structure.events) {
    const cell = buckets.get(getTradingSession(event.time))!;
    cell.events += 1;
    if (event.kind.includes("reversal")) cell.reversals += 1;
    else cell.breakouts += 1;
  }
  return Array.from(buckets.values()).map(cell => ({ ...cell, eventRate: cell.candles ? cell.events / cell.candles : 0 }));
}

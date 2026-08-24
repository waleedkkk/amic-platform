export type SignalLinkType = "confirmed" | "guessed" | "none";

export type PaperTradeSignalCandidate = {
  id: number;
  symbol: string;
  exchange: string;
  timeframe: string;
  recommendation: string;
  confidence: number;
  summary: string;
  createdAt: Date;
};

type TradeForSignalGuess = {
  symbol: string;
  exchange: string;
  openedAt: Date;
};

function normalizeInstrumentPart(value: string) {
  return value.trim().toUpperCase();
}

/**
 * للصفقات القديمة التي لا تحمل رابطًا صريحًا فقط: نختار أقرب إشارة سابقة
 * للصفقة على الرمز والبورصة نفسيهما. لا يمكن لإشارة لاحقة أن تصبح مرشحًا.
 */
export function guessClosestPriorSignal(
  trade: TradeForSignalGuess,
  signals: readonly PaperTradeSignalCandidate[],
): PaperTradeSignalCandidate | null {
  const openedAt = trade.openedAt.getTime();
  const matching = signals.filter(signal =>
    normalizeInstrumentPart(signal.symbol) === normalizeInstrumentPart(trade.symbol)
    && normalizeInstrumentPart(signal.exchange) === normalizeInstrumentPart(trade.exchange)
    && signal.createdAt.getTime() <= openedAt,
  );

  matching.sort((left, right) => {
    const distance = Math.abs(openedAt - left.createdAt.getTime()) - Math.abs(openedAt - right.createdAt.getTime());
    if (distance !== 0) return distance;
    return right.id - left.id;
  });

  return matching[0] ?? null;
}

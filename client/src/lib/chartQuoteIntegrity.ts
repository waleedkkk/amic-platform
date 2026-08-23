export type QuoteMergeCandidate = {
  symbol: string;
  sourceRole?: "primary" | "fallback";
  latestCandleClose: number | null | undefined;
  liveQuotePrice: number | null | undefined;
};

function isPreciousMetal(symbol: string) {
  return ["XAUUSD", "XAGUSD"].includes(symbol.trim().toUpperCase());
}

/**
 * لا نخلط اقتباس spot لحظي مع تاريخ futures احتياطي للمعادن؛ اختلاف الأصل
 * أو سعريه الكبير يشوّه المحور والطبقات أكثر مما يضيف حداثة مفيدة للرسم.
 */
export function shouldMergeLiveQuoteIntoLastCandle(candidate: QuoteMergeCandidate) {
  const latestClose = candidate.latestCandleClose;
  const livePrice = candidate.liveQuotePrice;
  if (!Number.isFinite(latestClose) || !Number.isFinite(livePrice) || (latestClose ?? 0) <= 0 || (livePrice ?? 0) <= 0) return false;
  if (isPreciousMetal(candidate.symbol) && candidate.sourceRole === "fallback") return false;

  const deviation = Math.abs((livePrice as number) - (latestClose as number)) / (latestClose as number);
  const maxDeviation = isPreciousMetal(candidate.symbol) ? 0.08 : 0.2;
  return deviation <= maxDeviation;
}

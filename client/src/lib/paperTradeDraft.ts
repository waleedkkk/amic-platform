export type PaperTradeDraft = {
  symbol: string;
  exchange: string;
  assetClass: "crypto" | "stock" | "forex" | "futures";
  side: "long" | "short";
  quantity: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  note: string;
};

const PAPER_TRADE_DRAFT_KEY = "amic.paper-trade-draft.v1";

export function assetClassForExchange(exchange: string): PaperTradeDraft["assetClass"] {
  const normalized = exchange.trim().toUpperCase();
  if (normalized === "BINANCE" || normalized === "KUCOIN") return "crypto";
  if (normalized === "FX" || normalized === "FOREX") return "forex";
  if (normalized === "OZ" || normalized === "COMEX") return "futures";
  return "stock";
}

export function recommendationToSide(value: unknown): PaperTradeDraft["side"] | null {
  const normalized = String(value ?? "").toLowerCase().replace(/[ -]/g, "_");
  if (normalized === "buy" || normalized === "strong_buy" || normalized === "bullish" || normalized === "long") return "long";
  if (normalized === "sell" || normalized === "strong_sell" || normalized === "bearish" || normalized === "short") return "short";
  return null;
}

export function makeAnalysisTradeDraft(input: { symbol: string; exchange: string; recommendation: unknown; price: unknown; note: string }): PaperTradeDraft | null {
  const side = recommendationToSide(input.recommendation);
  const entryPrice = Number(input.price);
  if (!side || !Number.isFinite(entryPrice) || entryPrice <= 0) return null;

  const stopLoss = side === "long" ? entryPrice * 0.98 : entryPrice * 1.02;
  const takeProfit = side === "long" ? entryPrice * 1.04 : entryPrice * 0.96;
  return {
    symbol: input.symbol.trim().toUpperCase(),
    exchange: input.exchange.trim().toUpperCase(),
    assetClass: assetClassForExchange(input.exchange),
    side,
    quantity: "1",
    entryPrice: String(entryPrice),
    stopLoss: stopLoss.toFixed(8),
    takeProfit: takeProfit.toFixed(8),
    note: `${input.note} القيم الافتراضية قابلة للتعديل وليست توصية استثمارية.`,
  };
}

export function storePaperTradeDraft(draft: PaperTradeDraft) {
  sessionStorage.setItem(PAPER_TRADE_DRAFT_KEY, JSON.stringify(draft));
}

export function consumePaperTradeDraft(): PaperTradeDraft | null {
  const raw = sessionStorage.getItem(PAPER_TRADE_DRAFT_KEY);
  sessionStorage.removeItem(PAPER_TRADE_DRAFT_KEY);
  if (!raw) return null;
  try {
    const draft = JSON.parse(raw) as PaperTradeDraft;
    if (!draft.symbol || !draft.exchange || !draft.entryPrice || !draft.side) return null;
    return draft;
  } catch {
    return null;
  }
}

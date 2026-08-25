import Decimal from "decimal.js";
import { getCandleHistoryCached } from "./candles";

export const PAPER_TRADE_PRICE_DEVIATION_THRESHOLD_PERCENT = 5;

export function calculatePriceDeviationPercent(closePriceValue: string, referencePriceValue: string): number | null {
  const closePrice = new Decimal(closePriceValue);
  const referencePrice = new Decimal(referencePriceValue);
  if (!closePrice.isFinite() || !referencePrice.isFinite() || referencePrice.lte(0)) return null;
  return closePrice.minus(referencePrice).abs().div(referencePrice).mul(100).toDecimalPlaces(4).toNumber();
}

export type PaperTradeReferencePrice = {
  price: string;
  provider: "twelve-data" | "yahoo" | "unknown";
  fetchedAt: string;
  candleTime: number | null;
};

/**
 * يعيد آخر سعر معروف من نفس الرمز والبورصة دون أن يجعل فشل المزود مانعًا للإغلاق.
 * يمر المسار عبر كاش الشموع الموجود ويدعم fallback المدمج بين Twelve Data وYahoo.
 */
export async function getPaperTradeReferencePrice(symbol: string, exchange: string): Promise<PaperTradeReferencePrice | null> {
  try {
    const history = await getCandleHistoryCached(symbol, exchange, "15m", "5d", 120);
    const latest = history.candles.at(-1);
    const price = history.regularMarketPrice ?? latest?.close ?? null;
    if (price === null || !Number.isFinite(price) || price <= 0) return null;

    return {
      price: price.toFixed(8),
      provider: history.provider ?? "unknown",
      fetchedAt: history.fetchedAt,
      candleTime: latest?.time ?? null,
    };
  } catch (error) {
    console.warn(`[PaperTradeReference] Reference unavailable for ${exchange}:${symbol}`, error instanceof Error ? error.message : String(error));
    return null;
  }
}

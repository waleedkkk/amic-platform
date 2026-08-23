/** يطلب ضبط العرض مرة واحدة فقط لكل مفتاح رمز/بورصة/إطار بعد وصول بياناته الحالية. */
export function getFitContentKey(
  pendingStableKey: string | null,
  stableKey: string,
  hasCurrentHistoricalData: boolean,
) {
  return pendingStableKey === stableKey && hasCurrentHistoricalData ? stableKey : null;
}

/**
 * أخطاء توفر مزود خارجي قد تظهر مؤقتًا ولا ينبغي أن تتحول إلى نافذة Console
 * في المعاينة؛ المكونات المعنية تعرض حالتها النصية للمستخدم بدلًا من ذلك.
 */
export function isExpectedExternalAvailabilityError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes("تعذر تنفيذ طلب TradingView MCP") || message.includes("TradingView MCP") && message.includes("fetch failed");
}

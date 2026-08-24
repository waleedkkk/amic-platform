import { describe, expect, it } from "vitest";
import { isExpectedExternalAvailabilityError } from "./apiErrorReporting";

describe("isExpectedExternalAvailabilityError", () => {
  it("يتعرف على انقطاع TradingView MCP المؤقت", () => {
    expect(isExpectedExternalAvailabilityError(new Error("تعذر تنفيذ طلب TradingView MCP بعد محاولة إعادة اتصال واحدة: fetch failed."))).toBe(true);
  });

  it("لا يخفي أخطاء المسارات البرمجية الحقيقية", () => {
    expect(isExpectedExternalAvailabilityError(new Error('No procedure found on path "orderFlow.getPreferences"'))).toBe(false);
  });
});

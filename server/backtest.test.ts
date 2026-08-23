import { describe, expect, it } from "vitest";
import { backtestErrorMessage, normalizeBacktestResult } from "../shared/backtest";

describe("عقد واجهة الباكتيست", () => {
  it("يحافظ على مخرجات المزود المنظمة ويحوّل المخرجات غير الصالحة إلى رسالة واضحة", () => {
    expect(normalizeBacktestResult({ total_return_pct: 12.4, trade_log: [] })).toMatchObject({ total_return_pct: 12.4 });
    expect(backtestErrorMessage(normalizeBacktestResult(null))).toContain("غير صالحة");
    expect(backtestErrorMessage(normalizeBacktestResult({ error: { code: "UPSTREAM_ERROR", message: "المصدر غير متاح" } }))).toBe("المصدر غير متاح");
  });
});

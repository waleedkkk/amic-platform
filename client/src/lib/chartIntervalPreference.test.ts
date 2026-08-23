import { describe, expect, it } from "vitest";
import { chartIntervalStorageKey, isStoredChartInterval } from "./chartIntervalPreference";

describe("تفضيل إطار الشارت المحلي", () => {
  it("يقبل الأطر المعتمدة فقط ويعزل المفتاح حسب البورصة والرمز", () => {
    expect(isStoredChartInterval("4h")).toBe(true);
    expect(isStoredChartInterval("2h")).toBe(false);
    expect(chartIntervalStorageKey("binance", "btcusdt")).toBe("amic:lastInterval:BINANCE:BTCUSDT");
  });
});

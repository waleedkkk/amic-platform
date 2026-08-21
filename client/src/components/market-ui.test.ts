import { describe, expect, it } from "vitest";
import { dataTableKeys } from "./market-ui";

describe("dataTableKeys", () => {
  it("يحد الحقول المعروضة إلى خمسة حقول مرتبة لتقديم بطاقات هاتف قابلة للمسح", () => {
    expect(dataTableKeys([
      { symbol: "BTCUSDT", price: 100, change: 1 },
      { symbol: "ETHUSDT", volume: 200, high: 110, low: 90 },
    ])).toEqual(["symbol", "price", "change", "volume", "high"]);
  });
});

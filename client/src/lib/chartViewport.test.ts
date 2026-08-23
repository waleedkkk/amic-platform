import { describe, expect, it } from "vitest";
import { getFitContentKey } from "./chartViewport";

describe("ضبط عرض مخطط الشموع", () => {
  it("لا يطلب fitContent مع تحديثات الشموع ما لم يكن المفتاح الجديد بانتظار بياناته", () => {
    expect(getFitContentKey(null, "BINANCE:BTCUSDT:1h", true)).toBeNull();
    expect(getFitContentKey("BINANCE:BTCUSDT:1h", "BINANCE:BTCUSDT:1h", false)).toBeNull();
    expect(getFitContentKey("BINANCE:BTCUSDT:1h", "BINANCE:BTCUSDT:1h", true)).toBe("BINANCE:BTCUSDT:1h");
    expect(getFitContentKey("BINANCE:BTCUSDT:1h", "BINANCE:BTCUSDT:4h", true)).toBeNull();
  });
});

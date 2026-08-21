import { describe, expect, it } from "vitest";
import { twelveDataInterval, tvSymbolToTwelveData } from "./candles";

describe("Twelve Data symbol and interval mapping", () => {
  it("يحول الأسهم وFX والمعادن والعملات الرقمية إلى صيغة المزود", () => {
    expect(tvSymbolToTwelveData("AAPL", "NASDAQ")).toBe("AAPL");
    expect(tvSymbolToTwelveData("EURUSD", "FX")).toBe("EUR/USD");
    expect(tvSymbolToTwelveData("XAUUSD", "FX")).toBe("XAU/USD");
    expect(tvSymbolToTwelveData("BTCUSDT", "BINANCE")).toBe("BTC/USD");
  });

  it("يحول فواصل AMIC إلى الفواصل المتوافقة مع Twelve Data", () => {
    expect(twelveDataInterval("60m")).toBe("1h");
    expect(twelveDataInterval("1d")).toBe("1day");
    expect(twelveDataInterval("1wk")).toBe("1week");
    expect(twelveDataInterval("15m")).toBe("15m");
  });
});

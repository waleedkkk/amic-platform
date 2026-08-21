import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getMarketSnapshot: vi.fn().mockResolvedValue(null),
  saveMarketSnapshot: vi.fn().mockResolvedValue(undefined),
}));

const { candleCacheTtlMs, tvSymbolToYahoo, fetchCandleHistory } = await import("./candles");

describe("tvSymbolToYahoo mapping", () => {
  it("maps US equity symbols unchanged", () => {
    expect(tvSymbolToYahoo("AAPL", "NASDAQ")).toBe("AAPL");
    expect(tvSymbolToYahoo("IBM", "NYSE")).toBe("IBM");
    expect(tvSymbolToYahoo("SPY", "AMEX")).toBe("SPY");
  });

  it("maps FX pairs to Yahoo currency format", () => {
    expect(tvSymbolToYahoo("EURUSD", "FX")).toBe("EURUSD=X");
    expect(tvSymbolToYahoo("USDCAD", "FX")).toBe("USDCAD=X");
    expect(tvSymbolToYahoo("EURUSD=X", "FX")).toBe("EURUSD=X");
  });

  it("maps Binance crypto to Yahoo crypto format", () => {
    expect(tvSymbolToYahoo("BTCUSDT", "BINANCE")).toBe("BTC-USD");
    expect(tvSymbolToYahoo("BTCUSD", "BINANCE")).toBe("BTC-USD");
    expect(tvSymbolToYahoo("ETHUSDT", "BINANCE")).toBe("ETH-USD");
  });
});

describe("سياسة تحديث الشموع", () => {
  it("تقلل TTL للفواصل القصيرة وتبقي الإطار العالي محميًا من كثرة الطلبات", () => {
    expect(candleCacheTtlMs("1m")).toBe(30_000);
    expect(candleCacheTtlMs("60m")).toBe(60_000);
    expect(candleCacheTtlMs("1d")).toBe(5 * 60 * 1000);
  });
});

describe("fetchCandleHistory", () => {
  afterEach(() => vi.restoreAllMocks());

  it("parses a valid Yahoo chart payload into ordered candles", async () => {
    const json = JSON.stringify({
      chart: {
        result: [
          {
            meta: {
              symbol: "AAPL",
              currency: "USD",
              exchangeName: "NMS",
              regularMarketPrice: 317.25,
            },
            timestamp: [1787068800, 1787155200, 1787241600],
            indicators: {
              quote: [
                {
                  open: [310, 312, null],
                  high: [313, 315, null],
                  low: [309, 311, null],
                  close: [312, 314, null],
                  volume: [1000, 2000, null],
                },
              ],
            },
          },
        ],
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => json,
      }),
    );

    const history = await fetchCandleHistory("AAPL", "NASDAQ", "1d", "1mo");
    expect(history.symbol).toBe("AAPL");
    expect(history.yahooSymbol).toBe("AAPL");
    expect(history.candles).toHaveLength(2);
    expect(history.currencies).toBeUndefined();
    expect(history.candles[0].open).toBe(310);
    expect(history.candles[1].volume).toBe(2000);
    expect(history.regularMarketPrice).toBe(317.25);
    // Ordered and null/invalid candles excluded
    for (let i = 1; i < history.candles.length; i += 1) {
      expect(history.candles[i].time).toBeGreaterThan(history.candles[i - 1].time);
    }
  });

  it("throws a clear error when the provider returns no result", async () => {
    const json = JSON.stringify({ chart: { error: "Not Found" } });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => json,
      }),
    );

    await expect(fetchCandleHistory("ZZZ", "NASDAQ", "1d", "1mo")).rejects.toThrow();
  });
});

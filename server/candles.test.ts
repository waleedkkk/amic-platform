import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./db", () => ({
  getMarketSnapshot: vi.fn().mockResolvedValue(null),
  saveMarketSnapshot: vi.fn().mockResolvedValue(undefined),
}));

const { candleCacheTtlMs, candleSnapshotTimeframe, tvSymbolToYahoo, fetchCandleHistory, getCandleHistoryCached, hasRenderableCandleHistory } = await import("./candles");
const { getMarketSnapshot, saveMarketSnapshot } = await import("./db");

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

  it("يقبل التاريخ القصير الصالح ويمنع الشمعة التاريخية المنفردة", () => {
    const oneCandle = [{ time: 1787068800, open: 310, high: 313, low: 309, close: 312, volume: 1000 }];
    const shortHistory = Array.from({ length: 3 }, (_, index) => ({
      time: 1787068800 + index * 60,
      open: 310 + index,
      high: 313 + index,
      low: 309 + index,
      close: 312 + index,
      volume: 1000,
    }));

    expect(hasRenderableCandleHistory(oneCandle, 180)).toBe(false);
    expect(hasRenderableCandleHistory(shortHistory, 180)).toBe(true);
  });

  it("يحفظ وصف الإطار ضمن حد عمود السوق ويبقي النطاق والحد داخل مفتاح الكاش", () => {
    expect(candleSnapshotTimeframe("15m")).toBe("15m");
    expect(candleSnapshotTimeframe("1wk")).toBe("1wk");
    expect(candleSnapshotTimeframe("15m").length).toBeLessThanOrEqual(8);
  });
});

describe("getCandleHistoryCached", () => {
  afterEach(() => vi.restoreAllMocks());

  it("يعيد التاريخ حتى لو فشلت كتابة كاش قاعدة البيانات", async () => {
    const count = 180;
    const timestamps = Array.from({ length: count }, (_, index) => 1780000000 + index * 900);
    const json = JSON.stringify({
      chart: {
        result: [{
          meta: { symbol: "BTC-USD", currency: "USD", exchangeName: "CCC" },
          timestamp: timestamps,
          indicators: { quote: [{
            open: timestamps.map((_, index) => 70_000 + index),
            high: timestamps.map((_, index) => 70_001 + index),
            low: timestamps.map((_, index) => 69_999 + index),
            close: timestamps.map((_, index) => 70_000 + index),
            volume: timestamps.map((_, index) => 1_000 + index),
          }] },
        }],
      },
    });
    vi.mocked(getMarketSnapshot).mockResolvedValue(null);
    vi.mocked(saveMarketSnapshot).mockRejectedValueOnce(new Error("simulated cache write failure"));
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => json }));

    const history = await getCandleHistoryCached("BTCUSDT", "BINANCE", "15m", "5d", 180);

    expect(history.candles).toHaveLength(180);
    expect(saveMarketSnapshot).toHaveBeenCalledWith(expect.objectContaining({
      cacheKey: "candles:BINANCE:BTCUSDT:15m:5d:180",
      timeframe: "15m",
    }));
  });
});

describe("fetchCandleHistory", () => {
  afterEach(() => vi.restoreAllMocks());

  it("يعيد تاريخ Yahoo القصير الصالح بدل إخفاء المخطط بالكامل", async () => {
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
    expect(history.candles).toHaveLength(2);
    expect(history.candles.map(candle => candle.close)).toEqual([312, 314]);
  });

  it("يعيد آخر عدد مطلوب من الشموع لتقليل حمولة المخطط", async () => {
    const count = 140;
    const timestamps = Array.from({ length: count }, (_, index) => 1780000000 + index * 86_400);
    const json = JSON.stringify({
      chart: {
        result: [{
          meta: { symbol: "AAPL", currency: "USD", exchangeName: "NMS" },
          timestamp: timestamps,
          indicators: { quote: [{
            open: timestamps.map((_, index) => 300 + index),
            high: timestamps.map((_, index) => 301 + index),
            low: timestamps.map((_, index) => 299 + index),
            close: timestamps.map((_, index) => 300 + index),
            volume: timestamps.map((_, index) => 1_000 + index),
          }] },
        }],
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => json }));

    const history = await fetchCandleHistory("AAPL", "NASDAQ", "1d", "1mo", 120);
    expect(history.candles).toHaveLength(120);
    expect(history.candles[0].close).toBe(320);
    expect(history.candles.at(-1)?.close).toBe(439);
  });

  it.each([
    ["1m", "1d", 180],
    ["60m", "1mo", 240],
    ["1d", "6mo", 440],
  ] as const)("يلتزم بحد الشموع للإطار %s والنطاق %s", async (interval, range, limit) => {
    const count = 500;
    const timestamps = Array.from({ length: count }, (_, index) => 1780000000 + index * 60);
    const json = JSON.stringify({
      chart: {
        result: [{
          meta: { symbol: "BTC-USD", currency: "USD", exchangeName: "CCC" },
          timestamp: timestamps,
          indicators: { quote: [{
            open: timestamps.map((_, index) => 100 + index),
            high: timestamps.map((_, index) => 101 + index),
            low: timestamps.map((_, index) => 99 + index),
            close: timestamps.map((_, index) => 100 + index),
            volume: timestamps.map((_, index) => 1_000 + index),
          }] },
        }],
      },
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, text: async () => json }));

    const history = await fetchCandleHistory("BTCUSDT", "BINANCE", interval, range, limit);
    expect(history.candles).toHaveLength(limit);
    expect(history.candles[0].close).toBe(600 - limit);
    expect(history.candles.at(-1)?.close).toBe(599);
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

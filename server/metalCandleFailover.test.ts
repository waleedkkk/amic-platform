import { describe, expect, it, vi } from "vitest";
import { fetchMetalCandleHistory } from "./candles";

function history(provider: "twelve-data" | "yahoo", candles = [
  { time: 1_700_000_000, open: 100, high: 103, low: 99, close: 101, volume: 10 },
  { time: 1_700_086_400, open: 101, high: 104, low: 100, close: 102, volume: 11 },
]) {
  return {
    symbol: "XAUUSD",
    yahooSymbol: provider === "yahoo" ? "GC=F" : "XAU/USD",
    provider,
    interval: "1d" as const,
    candles,
    currency: "USD",
    exchangeName: "FX",
    regularMarketPrice: 102,
    fetchedAt: "2026-08-23T00:00:00.000Z",
  };
}

describe("سلسلة احتياط شموع المعادن", () => {
  it("يفضل Twelve Data للذهب عندما يعيد تاريخًا صالحًا", async () => {
    const fetchTwelveData = vi.fn().mockResolvedValue(history("twelve-data"));
    const fetchYahoo = vi.fn().mockResolvedValue(history("yahoo"));

    const result = await fetchMetalCandleHistory("XAUUSD", "FX", "1d", "1mo", 120, undefined, { apiKey: "test-key", fetchTwelveData, fetchYahoo });

    expect(result.provider).toBe("twelve-data");
    expect(result.sourceRole).toBe("primary");
    expect(fetchTwelveData).toHaveBeenCalledTimes(1);
    expect(fetchYahoo).not.toHaveBeenCalled();
  });

  it("ينتقل إلى Yahoo للفضة عند عودة Twelve Data بتاريخ غير سليم", async () => {
    const fetchTwelveData = vi.fn().mockResolvedValue(history("twelve-data", [{ time: 1_700_000_000, open: 100, high: 99, low: 101, close: 100, volume: 10 }]));
    const fetchYahoo = vi.fn().mockResolvedValue(history("yahoo"));

    const result = await fetchMetalCandleHistory("XAGUSD", "FX", "1d", "1mo", 120, undefined, { apiKey: "test-key", fetchTwelveData, fetchYahoo });

    expect(result.provider).toBe("yahoo");
    expect(result.sourceRole).toBe("fallback");
    expect(fetchTwelveData).toHaveBeenCalledTimes(1);
    expect(fetchYahoo).toHaveBeenCalledTimes(1);
  });
});

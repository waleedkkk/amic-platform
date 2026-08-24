import { describe, expect, it } from "vitest";
import { getBinanceKlineStream, mergeHistoricalCandles, mergeLiveCandle, parseBinanceKlineMessage } from "../shared/chartLive";

describe("مسار البث الحي للشارت", () => {
  it("يُنشئ بث Binance للأزواج والأطر التي يدعمها فقط", () => {
    expect(getBinanceKlineStream("BTCUSDT", "BINANCE", "1m")).toBe("wss://stream.binance.com:9443/ws/btcusdt@kline_1m");
    expect(getBinanceKlineStream("ETHUSDT", "BINANCE", "60m")).toBe("wss://stream.binance.com:9443/ws/ethusdt@kline_1h");
    expect(getBinanceKlineStream("EURUSD", "FX", "1m")).toBeNull();
    expect(getBinanceKlineStream("BTCUSDT", "BINANCE", "1mo")).toBeNull();
  });

  it("يحوّل رسالة الشمعة ويحدّث الشمعة الجارية بدل تكرارها", () => {
    const live = parseBinanceKlineMessage(JSON.stringify({ E: 1_700_000_001_250, k: { t: 1_700_000_000_000, o: "100", h: "104", l: "99", c: "103", v: "12.5", x: false } }));
    expect(live).toEqual({ time: 1_700_000_000, open: 100, high: 104, low: 99, close: 103, volume: 12.5, observedAt: 1_700_000_001_250, isClosed: false });
    const merged = mergeLiveCandle([{ time: 1_700_000_000, open: 100, high: 101, low: 99, close: 100.5, volume: 5 }], live);
    expect(merged).toHaveLength(1);
    expect(merged[0].close).toBe(103);
  });

  it("لا يعرض شمعة بث منفردة قبل وصول التاريخ", () => {
    const live = { time: 1_700_000_000, open: 100, high: 104, low: 99, close: 103, volume: 12.5 };
    expect(mergeLiveCandle([], live)).toEqual([]);
  });

  it("يدمج التاريخ الأقدم بترتيب زمني ومن دون تكرار عند حد الدفعات", () => {
    const current = [
      { time: 20, open: 2, high: 3, low: 1, close: 2, volume: 1 },
      { time: 30, open: 3, high: 4, low: 2, close: 3, volume: 1 },
    ];
    const older = [
      { time: 10, open: 1, high: 2, low: 0.5, close: 1, volume: 1 },
      { time: 20, open: 99, high: 99, low: 99, close: 99, volume: 1 },
    ];
    expect(mergeHistoricalCandles(current, older)).toEqual([older[0], current[0], current[1]]);
  });

  it("يتجاهل رسائل البث غير الصالحة", () => {
    expect(parseBinanceKlineMessage("غير صالح")).toBeNull();
    expect(parseBinanceKlineMessage({ k: { t: "x" } })).toBeNull();
  });
});

import { describe, expect, it } from "vitest";
import { guessClosestPriorSignal, type PaperTradeSignalCandidate } from "./paperTradeSignalLink";

function signal(id: number, createdAt: string): PaperTradeSignalCandidate {
  return {
    id,
    symbol: "BTCUSDT",
    exchange: "BINANCE",
    timeframe: "1h",
    recommendation: "buy",
    confidence: 70,
    summary: `إشارة ${id}`,
    createdAt: new Date(createdAt),
  };
}

describe("مطابقة الإشارة الاحتياطية للصفقة الورقية", () => {
  const trade = { symbol: "BTCUSDT", exchange: "BINANCE", openedAt: new Date("2026-08-24T12:00:00.000Z") };

  it("يستبعد الإشارات المحفوظة بعد فتح الصفقة", () => {
    const result = guessClosestPriorSignal(trade, [
      signal(1, "2026-08-24T11:50:00.000Z"),
      signal(2, "2026-08-24T12:01:00.000Z"),
    ]);

    expect(result?.id).toBe(1);
  });

  it("يختار الإشارة السابقة الأقرب إلى وقت الفتح، لا الأحدث بلا قيد", () => {
    const result = guessClosestPriorSignal(trade, [
      signal(1, "2026-08-24T09:00:00.000Z"),
      signal(2, "2026-08-24T11:58:00.000Z"),
      signal(3, "2026-08-24T11:50:00.000Z"),
    ]);

    expect(result?.id).toBe(2);
  });

  it("يعيد null عند غياب إشارة سابقة مطابقة للصفقات القديمة", () => {
    const result = guessClosestPriorSignal(trade, [
      { ...signal(1, "2026-08-24T11:59:00.000Z"), symbol: "ETHUSDT" },
      signal(2, "2026-08-24T12:02:00.000Z"),
    ]);

    expect(result).toBeNull();
  });
});

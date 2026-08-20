import { describe, expect, it } from "vitest";
import { calculateRealizedPnl } from "./paperCalculations";

describe("calculateRealizedPnl", () => {
  it("يحسِب ربح صفقة long بدقة عشرية", () => {
    expect(calculateRealizedPnl({ side: "long", entryPrice: "100.25", exitPrice: "102.75", quantity: "2.4" })).toBe("6.00000000");
  });

  it("يحسِب ربح صفقة short بعكس حركة السعر", () => {
    expect(calculateRealizedPnl({ side: "short", entryPrice: "250", exitPrice: "230.5", quantity: "3" })).toBe("58.50000000");
  });

  it("يعيد خسارة عند تحرك السعر بعكس اتجاه الصفقة", () => {
    expect(calculateRealizedPnl({ side: "long", entryPrice: "1.2", exitPrice: "1.15", quantity: "1000" })).toBe("-50.00000000");
  });
});

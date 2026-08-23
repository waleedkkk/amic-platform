import { describe, expect, it } from "vitest";
import { describeCandleDataStatus, getMarketAssetProfile } from "../shared/marketAssetProfile";

describe("ملف الأصل وحالة مصدر الشموع", () => {
  it("يعرف الذهب والفضة وأزواج العملات بالدقة المناسبة", () => {
    expect(getMarketAssetProfile("XAUUSD", "FX")).toMatchObject({ kind: "metal", label: "الذهب / الدولار", priceDigits: 2, prioritizedTechnicalStatus: true });
    expect(getMarketAssetProfile("XAGUSD", "FX")).toMatchObject({ kind: "metal", priceDigits: 3 });
    expect(getMarketAssetProfile("EURUSD", "FX")).toMatchObject({ kind: "forex", label: "EUR/USD", priceDigits: 5, prioritizedTechnicalStatus: true });
    expect(getMarketAssetProfile("USDJPY", "FX")).toMatchObject({ kind: "forex", priceDigits: 3 });
  });

  it("يفرق بين المصدر الأساسي والاحتياطي والبيانات المؤجلة", () => {
    const now = Date.parse("2026-08-23T12:00:00.000Z");
    expect(describeCandleDataStatus({ provider: "twelve-data", sourceRole: "primary", fetchedAt: "2026-08-23T11:59:00.000Z" }, "15m", now)).toMatchObject({ mode: "primary", badge: "المصدر الأساسي" });
    expect(describeCandleDataStatus({ provider: "yahoo", sourceRole: "fallback", fetchedAt: "2026-08-23T11:59:00.000Z" }, "15m", now)).toMatchObject({ mode: "fallback", badge: "مصدر احتياطي" });
    expect(describeCandleDataStatus({ provider: "yahoo", sourceRole: "fallback", fetchedAt: "2026-08-23T10:00:00.000Z" }, "15m", now)).toMatchObject({ mode: "delayed", badge: "بيانات مؤجلة" });
  });
});

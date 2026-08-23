import { describe, expect, it } from "vitest";
import { selectEventsForPreAlert } from "./economicCalendarMonitor";

describe("تنبيه التقويم قبل ساعة", () => {
  it("يختار حدثًا عالي الأثر بوقت معلن داخل نافذة التذكير فقط", () => {
    const now = new Date("2026-08-10T12:00:00.000Z");
    const events = [
      { id: "cpi", title: "CPI", country: "United States", startsAt: "2026-08-10T13:00:00.000Z", source: "BLS", sourceUrl: "https://www.bls.gov", importance: "high", timeKnown: true },
      { id: "fomc", title: "FOMC", country: "United States", startsAt: "2026-08-10T13:00:00.000Z", source: "Federal Reserve", sourceUrl: "https://www.federalreserve.gov", importance: "high", timeKnown: false },
      { id: "low", title: "Low", country: "United States", startsAt: "2026-08-10T13:00:00.000Z", source: "BLS", sourceUrl: "https://www.bls.gov", importance: "medium", timeKnown: true },
    ] as const;
    expect(selectEventsForPreAlert([...events], now, 60).map(event => event.id)).toEqual(["cpi"]);
  });
});

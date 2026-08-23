import { describe, expect, it } from "vitest";
import { fetchOfficialEconomicCalendar } from "../shared/economicCalendar";

const liveOfficialCalendarTest = process.env.RUN_LIVE_PROVIDER_TESTS === "1" ? it : it.skip;

describe("مصادر التقويم الرسمية الحية", () => {
  liveOfficialCalendarTest("تعيد أحداثًا مستقبلية أو جارية من مصدر رسمي واحد على الأقل", async () => {
    const calendar = await fetchOfficialEconomicCalendar(new Date());
    expect(calendar.events.length).toBeGreaterThan(0);
    expect(calendar.events.some(event => event.source === "BLS" || event.source === "Federal Reserve")).toBe(true);
  }, 30_000);
});

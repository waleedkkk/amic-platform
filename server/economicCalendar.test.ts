import { describe, expect, it } from "vitest";
import { parseBlsIcs, parseFomcMeetings, zonedDateTimeToUtc } from "../shared/economicCalendar";

describe("التقويم الاقتصادي الرسمي المفتوح", () => {
  it("يحول وقت BLS الشرقي إلى UTC مع مراعاة التوقيت الصيفي ويصنف الأحداث عالية الأثر", () => {
    const ics = "BEGIN:VEVENT\nUID:cpi-1\nDTSTART;TZID=US-Eastern:20260812T083000\nSUMMARY:Consumer Price Index\nEND:VEVENT";
    const [event] = parseBlsIcs(ics);
    expect(event).toMatchObject({ id: "bls:cpi-1", importance: "high", source: "BLS", startsAt: "2026-08-12T12:30:00.000Z" });
    expect(zonedDateTimeToUtc(2026, 1, 7, 8, 30, "America/New_York")).toBe(Date.UTC(2026, 0, 7, 13, 30));
  });

  it("يستخرج موعد FOMC الرسمي كحدث عالٍ مع وسم وقت غير معلن", () => {
    const html = '<div><h4><a id="42828">2026 FOMC Meetings</a></h4><div><strong>September</strong></div><div>15-16*</div></div><div>2025 FOMC Meetings</div>';
    expect(parseFomcMeetings(html)).toEqual([expect.objectContaining({ id: "fomc:2026-09-16", source: "Federal Reserve", importance: "high", timeKnown: false })]);
  });
});

import { describe, expect, it } from "vitest";
import { getTradingSession } from "../shared/sessionHeatmap";

function utc(hour: number) { return Math.floor(Date.UTC(2026, 0, 1, hour, 0, 0) / 1_000); }

describe("تصنيف جلسات التداول UTC", () => {
  it("يصنف حدود آسيا ولندن ونيويورك كما هي معرفة في الخريطة", () => {
    expect(getTradingSession(utc(0))).toBe("asia");
    expect(getTradingSession(utc(7))).toBe("asia");
    expect(getTradingSession(utc(8))).toBe("london");
    expect(getTradingSession(utc(12))).toBe("london");
    expect(getTradingSession(utc(13))).toBe("newYork");
    expect(getTradingSession(utc(20))).toBe("newYork");
    expect(getTradingSession(utc(21))).toBe("asia");
  });
});

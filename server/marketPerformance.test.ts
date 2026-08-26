import { afterEach, describe, expect, it } from "vitest";
import { getMarketPerformanceSummary, recordCandleCacheMeasurement, resetMarketPerformanceMeasurements } from "./marketPerformance";

describe("market performance measurements", () => {
  afterEach(() => resetMarketPerformanceMeasurements());

  it("يجمع طبقات الكاش وزمن الطلبات من دون الاحتفاظ بمدخلات السوق أو المستخدم", () => {
    recordCandleCacheMeasurement({ cacheStatus: "memory", durationMs: 10, outcome: "success" });
    recordCandleCacheMeasurement({ cacheStatus: "snapshot", durationMs: 30, outcome: "success" });
    recordCandleCacheMeasurement({ cacheStatus: "fresh", durationMs: 50, outcome: "success" });
    recordCandleCacheMeasurement({ cacheStatus: null, durationMs: 999, outcome: "error" });

    const summary = getMarketPerformanceSummary(new Date("2026-08-26T11:45:00.000Z"));

    expect(summary).toMatchObject({
      scope: "current_process",
      candles: {
        requests: 4,
        successfulRequests: 3,
        failedRequests: 1,
        cacheHits: 2,
        memoryHits: 1,
        snapshotHits: 1,
        freshFetches: 1,
        cacheHitRate: 66.7,
        averageLatencyMs: 30,
        p95LatencyMs: 50,
      },
    });
    expect(JSON.stringify(summary)).not.toContain("BTCUSDT");
    expect(JSON.stringify(summary)).not.toContain("userId");
  });
});

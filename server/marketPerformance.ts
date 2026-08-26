export type CandleCacheStatus = "memory" | "snapshot" | "fresh";

type CandleCacheMeasurement = {
  cacheStatus: CandleCacheStatus | null;
  durationMs: number;
  outcome: "success" | "error";
};

const MAX_DURATION_SAMPLES = 240;

let startedAt = new Date();
let totalRequests = 0;
let successfulRequests = 0;
let failedRequests = 0;
let memoryHits = 0;
let snapshotHits = 0;
let freshFetches = 0;
let durationSamples: number[] = [];

/**
 * قياس مجمع داخل عملية الخادم فقط. لا يسجل رموزًا أو بورصات أو userId أو محتوى
 * أو مفاتيح؛ ويُعاد ضبطه تلقائيًا عند إعادة تشغيل العملية.
 */
export function recordCandleCacheMeasurement(measurement: CandleCacheMeasurement) {
  totalRequests += 1;
  if (measurement.outcome === "error") {
    failedRequests += 1;
    return;
  }

  successfulRequests += 1;
  if (measurement.cacheStatus === "memory") memoryHits += 1;
  if (measurement.cacheStatus === "snapshot") snapshotHits += 1;
  if (measurement.cacheStatus === "fresh") freshFetches += 1;

  const durationMs = Math.max(0, Math.round(measurement.durationMs));
  durationSamples = [...durationSamples, durationMs].slice(-MAX_DURATION_SAMPLES);
}

function percentile(values: number[], percentileValue: number) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * percentileValue) - 1))];
}

export function getMarketPerformanceSummary(observedAt = new Date()) {
  const cacheHits = memoryHits + snapshotHits;
  const latencyCount = durationSamples.length;
  return {
    scope: "current_process" as const,
    startedAt,
    observedAt,
    candles: {
      requests: totalRequests,
      successfulRequests,
      failedRequests,
      cacheHits,
      memoryHits,
      snapshotHits,
      freshFetches,
      cacheHitRate: successfulRequests ? Number(((cacheHits / successfulRequests) * 100).toFixed(1)) : null,
      latencySamples: latencyCount,
      averageLatencyMs: latencyCount ? Math.round(durationSamples.reduce((total, value) => total + value, 0) / latencyCount) : null,
      p95LatencyMs: percentile(durationSamples, 0.95),
    },
  };
}

/** مخصص للاختبارات فقط؛ لا يُستدعى من Router أو واجهة الإنتاج. */
export function resetMarketPerformanceMeasurements() {
  startedAt = new Date();
  totalRequests = 0;
  successfulRequests = 0;
  failedRequests = 0;
  memoryHits = 0;
  snapshotHits = 0;
  freshFetches = 0;
  durationSamples = [];
}

export type MarketSnapshotL1Entry = { payload: unknown; expiresAt: number };

/**
 * كاش محلي لعملية Node واحدة. تعدد النسخ قد يكرر جلبًا بسيطًا بين العمليات،
 * لكنه لا يؤثر في اتساق كاش MySQL المشترك ولا يستبدل التخزين الدائم.
 */
export function createMarketSnapshotL1Cache(maxEntries = 500) {
  const entries = new Map<string, MarketSnapshotL1Entry>();

  function get(key: string, now = Date.now()) {
    const entry = entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= now) {
      entries.delete(key);
      return undefined;
    }
    // إعادة الإدراج تجعل الإخلاء البسيط أقرب إلى LRU.
    entries.delete(key);
    entries.set(key, entry);
    return entry.payload;
  }

  function set(key: string, payload: unknown, expiresAt: Date | number) {
    const expiresAtMs = expiresAt instanceof Date ? expiresAt.getTime() : expiresAt;
    entries.delete(key);
    while (entries.size >= maxEntries) {
      const oldestKey = entries.keys().next().value as string | undefined;
      if (!oldestKey) break;
      entries.delete(oldestKey);
    }
    entries.set(key, { payload, expiresAt: expiresAtMs });
  }

  return { get, set, clear: () => entries.clear(), size: () => entries.size };
}

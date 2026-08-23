import { describe, expect, it, vi } from "vitest";
import { createMarketSnapshotL1Cache } from "./marketSnapshotL1";

describe("كاش لقطات السوق L1", () => {
  it("يعيد القراءة الثانية ضمن TTL من الذاكرة دون استدعاء قارئ قاعدة البيانات", async () => {
    const cache = createMarketSnapshotL1Cache();
    const databaseRead = vi.fn().mockResolvedValue({ close: 77_000 });
    const readSnapshot = async (key: string, now: number) => {
      const inMemory = cache.get(key, now);
      if (inMemory !== undefined) return inMemory;
      const payload = await databaseRead(key);
      cache.set(key, payload, now + 45_000);
      return payload;
    };

    await expect(readSnapshot("analysis:BTCUSDT", 1_000)).resolves.toEqual({ close: 77_000 });
    await expect(readSnapshot("analysis:BTCUSDT", 2_000)).resolves.toEqual({ close: 77_000 });
    expect(databaseRead).toHaveBeenCalledTimes(1);
  });

  it("يحذف المنتهية ويخلي أقدم مفتاح عند تجاوز الحد", () => {
    const cache = createMarketSnapshotL1Cache(2);
    cache.set("old", 1, 10_000);
    cache.set("recent", 2, 10_000);
    cache.set("new", 3, 10_000);
    expect(cache.get("old", 1_000)).toBeUndefined();
    expect(cache.get("recent", 1_000)).toBe(2);
    cache.set("expired", 4, 500);
    expect(cache.get("expired", 1_000)).toBeUndefined();
  });
});

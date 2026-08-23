import { describe, expect, it, vi } from "vitest";
import { cleanupExpiredMarketSnapshots, getMarketSnapshotCleanupCutoff, shouldCleanupMarketSnapshot } from "./db";
import { marketSnapshots } from "../drizzle/schema";

describe("تنظيف لقطات السوق المنتهية", () => {
  it("يحتفظ باللقطات المنتهية منذ يوم أو أقل ويحذف الأقدم فقط", async () => {
    const now = new Date("2026-08-23T00:00:00.000Z");
    const cutoff = getMarketSnapshotCleanupCutoff(now);
    expect(cutoff.toISOString()).toBe("2026-08-22T00:00:00.000Z");
    expect(shouldCleanupMarketSnapshot(new Date("2026-08-21T23:59:59.999Z"), now)).toBe(true);
    expect(shouldCleanupMarketSnapshot(new Date("2026-08-22T00:00:00.000Z"), now)).toBe(false);
    expect(shouldCleanupMarketSnapshot(new Date("2026-08-22T23:59:59.000Z"), now)).toBe(false);

    const where = vi.fn().mockResolvedValue([{ affectedRows: 2 }]);
    const db = { delete: vi.fn(() => ({ where })) };
    await expect(cleanupExpiredMarketSnapshots({ now, db })).resolves.toBe(2);
    expect(db.delete).toHaveBeenCalledWith(marketSnapshots);
    expect(where).toHaveBeenCalledTimes(1);
  });
});

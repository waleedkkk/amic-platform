import { describe, expect, it, vi } from "vitest";
import { createInFlightRequestCoalescer } from "./cacheCoalescing";

describe("مشاركة طلبات الكاش الجارية", () => {
  it("يجعل الطلبين المتزامنين لنفس المفتاح ينتظران تحميلًا واحدًا فقط", async () => {
    const coalescer = createInFlightRequestCoalescer();
    let resolveLoad!: (value: { price: number }) => void;
    const load = vi.fn(() => new Promise<{ price: number }>(resolve => { resolveLoad = resolve; }));

    const first = coalescer.run("analysis:BTCUSDT", load);
    const second = coalescer.run("analysis:BTCUSDT", load);
    await Promise.resolve();
    expect(load).toHaveBeenCalledTimes(1);
    expect(coalescer.size()).toBe(1);

    resolveLoad({ price: 77_000 });
    await expect(Promise.all([first, second])).resolves.toEqual([{ price: 77_000 }, { price: 77_000 }]);
    expect(coalescer.size()).toBe(0);
  });

  it("يزيل المفتاح بعد الفشل حتى تصبح المحاولة التالية ممكنة", async () => {
    const coalescer = createInFlightRequestCoalescer();
    const load = vi.fn().mockRejectedValueOnce(new Error("temporary provider failure")).mockResolvedValueOnce("recovered");

    await expect(coalescer.run("analysis:BTCUSDT", load)).rejects.toThrow("temporary provider failure");
    await expect(coalescer.run("analysis:BTCUSDT", load)).resolves.toBe("recovered");
    expect(load).toHaveBeenCalledTimes(2);
  });
});

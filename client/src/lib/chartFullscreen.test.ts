import { describe, expect, it, vi } from "vitest";
import { getChartFullscreenPortalContainer, isChartFullscreenTarget, requestChartFullscreen } from "./chartFullscreen";

describe("وضع ملء شاشة المخطط", () => {
  it("يستخدم وضع المتصفح الأصلي عندما يتوفر وينجح", async () => {
    const requestFullscreen = vi.fn().mockResolvedValue(undefined);
    await expect(requestChartFullscreen({ requestFullscreen })).resolves.toBe("native");
    expect(requestFullscreen).toHaveBeenCalledOnce();
  });

  it("يعود إلى الوضع المرئي البديل عند غياب الواجهة أو رفضها", async () => {
    await expect(requestChartFullscreen({})).resolves.toBe("fallback");
    await expect(requestChartFullscreen({ requestFullscreen: vi.fn().mockRejectedValue(new Error("blocked")) })).resolves.toBe("fallback");
  });

  it("يتعرف على عنصر المخطط النشط فقط", () => {
    const target = {} as Element;
    expect(isChartFullscreenTarget(target, target)).toBe(true);
    expect(isChartFullscreenTarget(target, {} as Element)).toBe(false);
    expect(isChartFullscreenTarget(null, target)).toBe(false);
  });

  it("يركب القوائم المنبثقة داخل عنصر المخطط في وضع ملء الشاشة", () => {
    const chart = {} as HTMLDivElement;
    expect(getChartFullscreenPortalContainer(true, chart)).toBe(chart);
    expect(getChartFullscreenPortalContainer(false, chart)).toBeUndefined();
  });
});

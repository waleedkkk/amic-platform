import { describe, expect, it } from "vitest";

const liveFmpTest = process.env.RUN_LIVE_PROVIDER_TESTS === "1" ? it : it.skip;

describe("مفتاح FMP للتقويم الاقتصادي", () => {
  liveFmpTest("يصل إلى نقطة التقويم الرسمية دون كشف المفتاح", async () => {
    const apiKey = process.env.FMP_API_KEY;
    expect(apiKey, "FMP_API_KEY must be configured").toBeTruthy();
    const today = new Date().toISOString().slice(0, 10);
    const response = await fetch(`https://financialmodelingprep.com/stable/economic-calendar?from=${today}&to=${today}&apikey=${encodeURIComponent(apiKey!)}`);
    expect(response.ok, `FMP HTTP ${response.status}`).toBe(true);
    expect(Array.isArray(await response.json())).toBe(true);
  }, 15_000);
});

import { describe, expect, it, vi } from "vitest";
import { verifyProviderConnection } from "./aiProviderVerifier";

describe("verifyProviderConnection", () => {
  it("يتحقق من مفتاح OpenAI والنموذج عبر مسار النماذج دون إرجاع المفتاح", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200 }));

    const result = await verifyProviderConnection({ provider: "openai", apiKey: "sk-test-secret", model: "gpt-4o-mini" }, fetcher);

    expect(result).toEqual({ valid: true, message: "نجح اختبار اتصال OpenAI والنموذج المحدد." });
    expect(fetcher).toHaveBeenCalledWith("https://api.openai.com/v1/models/gpt-4o-mini", expect.objectContaining({ headers: { Authorization: "Bearer sk-test-secret" } }));
    expect(JSON.stringify(result)).not.toContain("sk-test-secret");
  });

  it("يعيد نتيجة آمنة عند رفض المفتاح ولا يمرر نص استجابة المزود", async () => {
    const result = await verifyProviderConnection(
      { provider: "anthropic", apiKey: "sk-ant-invalid", model: "claude-3-5-haiku-latest" },
      async () => ({ ok: false, status: 401 }),
    );

    expect(result.valid).toBe(false);
    expect(result.message).toContain("مفتاح");
    expect(JSON.stringify(result)).not.toContain("sk-ant-invalid");
  });

  it("يرسل مفتاح Gemini كترويسة لا كمعامل URL ويتعامل مع نموذج غير متاح", async () => {
    const fetcher = vi.fn(async () => ({ ok: false, status: 404 }));

    const result = await verifyProviderConnection({ provider: "google", apiKey: "AIza-test-secret", model: "models/gemini-2.0-flash" }, fetcher);

    expect(result.valid).toBe(false);
    expect(result.message).toContain("النموذج المحدد");
    expect(fetcher).toHaveBeenCalledWith("https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash", expect.objectContaining({ headers: { "x-goog-api-key": "AIza-test-secret" } }));
    expect(fetcher.mock.calls[0]?.[0]).not.toContain("AIza-test-secret");
  });

  it("يتحقق من مفتاح OpenRouter عبر نقطة المفتاح الرسمية دون توليد", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200 }));

    const result = await verifyProviderConnection({ provider: "openrouter", apiKey: "sk-or-test-secret", model: "openai/gpt-4o-mini" }, fetcher);

    expect(result.valid).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("https://openrouter.ai/api/v1/key", expect.objectContaining({ headers: { Authorization: "Bearer sk-or-test-secret" } }));
    expect(JSON.stringify(result)).not.toContain("sk-or-test-secret");
  });

  it("يتحقق من ZenMux عبر عنوانه المتوافق مع OpenAI دون وضع المفتاح في URL", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200 }));

    const result = await verifyProviderConnection({ provider: "zenmux", apiKey: "zm-test-secret", model: "google/gemini-3.1-pro-preview" }, fetcher);

    expect(result.valid).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("https://zenmux.ai/api/v1/models/google/gemini-3.1-pro-preview", expect.objectContaining({ headers: { Authorization: "Bearer zm-test-secret" } }));
    expect(fetcher.mock.calls[0]?.[0]).not.toContain("zm-test-secret");
  });
});

import { describe, expect, it, vi } from "vitest";
import { normalizeCustomBaseUrl } from "./aiProviderBaseUrl";
import { listProviderModels, verifyProviderConnection } from "./aiProviderVerifier";

describe("عناوين API المخصصة للمزودات المتوافقة مع OpenAI", () => {
  it("يطبع عنوان HTTPS صالحًا ويحذف الشرطة المائلة الختامية", () => {
    expect(normalizeCustomBaseUrl("zenmux", " https://gateway.example.com/v1/ ")).toBe("https://gateway.example.com/v1");
  });

  it("يرفض HTTP والعناوين المحلية وعناوين IP المباشرة", () => {
    expect(() => normalizeCustomBaseUrl("openai", "http://gateway.example.com/v1")).toThrow("HTTPS");
    expect(() => normalizeCustomBaseUrl("openai", "https://localhost/v1")).toThrow("محلية");
    expect(() => normalizeCustomBaseUrl("openai", "https://127.0.0.1/v1")).toThrow("محلية");
  });

  it("يستخدم العنوان المخصص في اختبار المفتاح دون إدراج المفتاح في الرابط", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200 }));
    const result = await verifyProviderConnection({ provider: "zenmux", apiKey: "zm-test-secret", model: "custom/chat", customBaseUrl: "https://gateway.example.com/v1" }, fetcher);

    expect(result.valid).toBe(true);
    expect(fetcher).toHaveBeenCalledWith("https://gateway.example.com/v1/models/custom/chat", expect.objectContaining({ headers: { Authorization: "Bearer zm-test-secret" } }));
    expect(fetcher.mock.calls[0]?.[0]).not.toContain("zm-test-secret");
  });

  it("يجلب كتالوج النماذج من العنوان المخصص", async () => {
    const fetcher = vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ data: [{ id: "custom/chat", owned_by: "gateway" }] }) }));
    const result = await listProviderModels({ provider: "openai", apiKey: "sk-test-secret", customBaseUrl: "https://gateway.example.com/v1" }, fetcher);

    expect(result).toEqual({ success: true, models: [{ id: "custom/chat", label: "custom/chat", owner: "gateway" }] });
    expect(fetcher).toHaveBeenCalledWith("https://gateway.example.com/v1/models", expect.anything());
  });
});

import { afterEach, describe, expect, it } from "vitest";
import { decryptProviderKey, encryptProviderKey, getKeyHint, PROVIDER_KEY_CIPHER } from "./aiProviderCrypto";

const originalSecret = process.env.JWT_SECRET;

afterEach(() => {
  process.env.JWT_SECRET = originalSecret;
});

describe("تشفير مفاتيح مزودي الذكاء الاصطناعي", () => {
  it("يخزّن المفتاح مشفرًا ويستعيده بالقيمة نفسها", () => {
    process.env.JWT_SECRET = "test-server-secret";
    const encrypted = encryptProviderKey("sk-test-provider-key-1234");
    expect(PROVIDER_KEY_CIPHER).toBe("aes-256-gcm");
    expect(encrypted).toMatch(/^v1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
    expect(encrypted).not.toContain("sk-test-provider-key-1234");
    expect(decryptProviderKey(encrypted)).toBe("sk-test-provider-key-1234");
  });

  it("لا يتيح سوى تلميح مقنّع للمفتاح", () => {
    expect(getKeyHint("sk-test-provider-key-1234")).toBe("••••1234");
  });
});

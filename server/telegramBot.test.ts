import { describe, expect, it } from "vitest";

describe("Telegram bot credential", () => {
  it("يتحقق من رمز البوت عبر نقطة getMe الرسمية دون طباعته", async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    expect(token, "يجب توفير TELEGRAM_BOT_TOKEN").toMatch(/^\d{5,}:[A-Za-z0-9_-]{20,}$/);

    const response = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    expect(response.ok, `Telegram HTTP ${response.status}`).toBe(true);
    const payload = await response.json() as { ok?: boolean; result?: { is_bot?: boolean } };
    expect(payload.ok).toBe(true);
    expect(payload.result?.is_bot).toBe(true);
  }, 15_000);
});

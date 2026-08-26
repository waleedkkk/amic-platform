import { describe, expect, it } from "vitest";
import { adminAiRouter } from "./adminAi";

describe("adminAiRouter authorization", () => {
  it("يرفض قراءة إعدادات مزودي الذكاء الاصطناعي عند غياب مستخدم مدير", async () => {
    const caller = adminAiRouter.createCaller({ user: null } as never);

    await expect(caller.list()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يرفض الوصول عند وجود مستخدم عادي", async () => {
    const caller = adminAiRouter.createCaller({ user: { id: 7, role: "user" } } as never);

    await expect(caller.marketProviderStatus()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يرفض اختبار مفتاح API لغير المدير قبل إجراء أي اتصال خارجي", async () => {
    const caller = adminAiRouter.createCaller({ user: { id: 7, role: "user" } } as never);

    await expect(caller.testConnection({ provider: "openai", model: "gpt-4o-mini", apiKey: "sk-test-key" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يرفض جلب كتالوج النماذج لغير المدير قبل قراءة المفتاح المشفر أو الاتصال بالمزود", async () => {
    const caller = adminAiRouter.createCaller({ user: { id: 7, role: "user" } } as never);

    await expect(caller.listModels({ provider: "openrouter" })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يرفض مراقبة استهلاك النماذج لغير المدير", async () => {
    const caller = adminAiRouter.createCaller({ user: { id: 7, role: "user" } } as never);

    await expect(caller.usage({ periodDays: 7 })).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

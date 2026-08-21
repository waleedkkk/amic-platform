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
});

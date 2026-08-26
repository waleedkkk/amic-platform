import { describe, expect, it } from "vitest";

import { adminDashboardRouter } from "./adminDashboard";

describe("adminDashboardRouter authorization", () => {
  it("يرفض الملخص التشغيلي عند المستخدم العادي قبل قراءة بيانات النظام", async () => {
    const caller = adminDashboardRouter.createCaller({ user: { id: 7, role: "user" } } as never);

    await expect(caller.overview()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يرفض تنظيف الكاش الإداري عند غياب حساب مدير", async () => {
    const caller = adminDashboardRouter.createCaller({ user: null } as never);

    await expect(caller.cleanupExpiredSnapshots()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });

  it("يرفض قراءة ملخص أداء الكاش عند المستخدم العادي", async () => {
    const caller = adminDashboardRouter.createCaller({ user: { id: 7, role: "user" } } as never);

    await expect(caller.marketPerformance()).rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});

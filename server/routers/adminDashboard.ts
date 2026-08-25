import { cleanupExpiredMarketSnapshots, getAdminOperationsSummary } from "../db";
import { adminProcedure, router } from "../_core/trpc";

/** إجراءات تشغيلية إدارية ضيقة النطاق؛ لا تعرض بيانات مستخدمين أو أسرارًا. */
export const adminDashboardRouter = router({
  overview: adminProcedure.query(() => getAdminOperationsSummary()),
  cleanupExpiredSnapshots: adminProcedure.mutation(async () => ({
    deleted: await cleanupExpiredMarketSnapshots(),
    completedAt: new Date(),
  })),
});

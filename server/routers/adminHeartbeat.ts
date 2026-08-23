import { z } from "zod";
import {
  getMarketSnapshotCleanupMonitorTaskUid,
  saveMarketSnapshotCleanupMonitorTaskUid,
} from "../db";
import { createHeartbeatJob } from "../_core/heartbeat";
import { getSessionTokenFromRequest } from "../localAuth";
import { adminProcedure, router } from "../_core/trpc";

const cleanupScheduleInput = z.object({
  cron: z.string().trim().regex(/^\S+(\s+\S+){5}$/, "يجب إدخال تعبير cron من ستة حقول.").default("0 0 * * * *"),
});

export const adminHeartbeatRouter = router({
  registerMarketSnapshotCleanup: adminProcedure
    .input(cleanupScheduleInput.nullish())
    .mutation(async ({ input, ctx }) => {
      const existingTaskUid = await getMarketSnapshotCleanupMonitorTaskUid();
      if (existingTaskUid) return { taskUid: existingTaskUid, created: false } as const;

      const job = await createHeartbeatJob(
        {
          name: "amic-market-snapshot-cleanup",
          cron: input?.cron ?? "0 0 * * * *",
          path: "/api/scheduled/market-snapshot-cleanup",
          description: "Delete AMIC market snapshots expired for more than 24 hours",
        },
        getSessionTokenFromRequest(ctx.req) ?? "",
      );
      await saveMarketSnapshotCleanupMonitorTaskUid(job.taskUid);
      return { taskUid: job.taskUid, nextExecutionAt: job.nextExecutionAt ?? null, created: true } as const;
    }),
});

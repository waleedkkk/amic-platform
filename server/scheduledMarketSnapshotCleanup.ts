import type { Request, Response } from "express";
import { cleanupExpiredMarketSnapshots, getMarketSnapshotCleanupMonitorTaskUid } from "./db";
import { CronAuthenticationError, sdk } from "./_core/sdk";

/** معالج Heartbeat: لا يستخدم setInterval لأن بيئات الإنتاج قد تتوقف بين الطلبات. */
export async function handleMarketSnapshotCleanupSchedule(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const registeredTaskUid = await getMarketSnapshotCleanupMonitorTaskUid();
    if (registeredTaskUid !== user.taskUid) return res.json({ ok: true, skipped: "orphan" });
    const deleted = await cleanupExpiredMarketSnapshots();
    console.info(`[Market snapshots] hourly cleanup removed ${deleted} expired rows`);
    return res.json({ ok: true, taskUid: user.taskUid, deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Market snapshots] scheduled cleanup failed", message);
    return res.status(500).json({
      error: message,
      context: { path: req.path },
      cronDiagnostics: error instanceof CronAuthenticationError ? error.diagnostics : undefined,
      timestamp: new Date().toISOString(),
    });
  }
}

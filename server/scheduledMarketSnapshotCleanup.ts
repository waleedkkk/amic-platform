import type { Request, Response } from "express";
import { cleanupExpiredMarketSnapshots } from "./db";
import { sdk } from "./_core/sdk";

/** معالج Heartbeat: لا يستخدم setInterval لأن بيئات الإنتاج قد تتوقف بين الطلبات. */
export async function handleMarketSnapshotCleanupSchedule(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron) return res.status(403).json({ error: "cron-only" });
    const deleted = await cleanupExpiredMarketSnapshots();
    console.info(`[Market snapshots] hourly cleanup removed ${deleted} expired rows`);
    return res.json({ ok: true, deleted });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Market snapshots] scheduled cleanup failed", message);
    return res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}

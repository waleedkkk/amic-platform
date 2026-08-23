import type { Request, Response } from "express";
import { getDailyMarketDigestMonitorTaskUid } from "./db";
import { sendDailyMarketDigests } from "./dailyMarketDigest";
import { sdk } from "./_core/sdk";

export async function handleDailyMarketDigestSchedule(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    if (await getDailyMarketDigestMonitorTaskUid() !== user.taskUid) return res.json({ ok: true, skipped: "orphan" });
    return res.json({ ok: true, taskUid: user.taskUid, ...(await sendDailyMarketDigests()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Daily market digest] scheduled run failed", message);
    return res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}

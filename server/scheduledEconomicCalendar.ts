import type { Request, Response } from "express";
import { getEconomicCalendarMonitorTaskUid } from "./db";
import { checkEconomicCalendarPreAlerts } from "./economicCalendarMonitor";
import { sdk } from "./_core/sdk";

export async function handleEconomicCalendarSchedule(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const registeredTaskUid = await getEconomicCalendarMonitorTaskUid();
    if (registeredTaskUid !== user.taskUid) return res.json({ ok: true, skipped: "orphan" });
    return res.json({ ok: true, taskUid: user.taskUid, ...(await checkEconomicCalendarPreAlerts()) });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Economic calendar] scheduled check failed", message);
    return res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}

import type { Request, Response } from "express";
import { getMetalAlertMonitorTaskUid } from "./db";
import { checkActiveMetalAlerts } from "./metalAlertMonitor";
import { checkActiveStructureAlerts } from "./structureAlertMonitor";
import { sdk } from "./_core/sdk";

export async function handleMetalAlertsSchedule(req: Request, res: Response) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user.isCron || !user.taskUid) return res.status(403).json({ error: "cron-only" });
    const registeredTaskUid = await getMetalAlertMonitorTaskUid();
    if (registeredTaskUid !== user.taskUid) return res.json({ ok: true, skipped: "orphan" });
    const [metal, structure] = await Promise.all([checkActiveMetalAlerts(), checkActiveStructureAlerts()]);
    return res.json({ ok: true, taskUid: user.taskUid, metal, structure });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("[Metal alerts] scheduled check failed", message);
    return res.status(500).json({ error: message, context: { path: req.path }, timestamp: new Date().toISOString() });
  }
}

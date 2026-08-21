import Decimal from "decimal.js";
import { and, desc, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertSavedSignal,
  chartPreferences,
  InsertUser,
  marketSnapshots,
  metalAlertMonitorSettings,
  metalAlerts,
  structureAlerts,
  paperTrades,
  savedSignals,
  userNotifications,
  userTelegramSettings,
  users,
  watchlists,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { calculateRealizedPnl } from "./paperCalculations";

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

async function requireDb() {
  const db = await getDb();
  if (!db) throw new Error("قاعدة البيانات غير متاحة حاليًا.");
  return db;
}

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) return;

  const values: InsertUser = { openId: user.openId };
  const updateSet: Record<string, unknown> = {};
  const textFields = ["name", "email", "loginMethod"] as const;
  textFields.forEach(field => {
    if (user[field] !== undefined) {
      values[field] = user[field] ?? null;
      updateSet[field] = user[field] ?? null;
    }
  });
  values.lastSignedIn = user.lastSignedIn ?? new Date();
  updateSet.lastSignedIn = values.lastSignedIn;
  if (user.role !== undefined) {
    values.role = user.role;
    updateSet.role = user.role;
  } else if (user.openId === ENV.ownerOpenId) {
    values.role = "admin";
    updateSet.role = "admin";
  }
  await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result[0];
}

export type PaperTradeInput = {
  symbol: string;
  exchange: string;
  assetClass: "crypto" | "stock" | "forex" | "futures";
  side: "long" | "short";
  quantity: string;
  entryPrice: string;
  stopLoss?: string;
  takeProfit?: string;
  note?: string;
};

export async function listUserPaperTrades(userId: number) {
  const db = await requireDb();
  return db.select().from(paperTrades).where(eq(paperTrades.userId, userId)).orderBy(desc(paperTrades.updatedAt));
}

export async function createPaperTrade(userId: number, input: PaperTradeInput) {
  const db = await requireDb();
  const quantity = new Decimal(input.quantity);
  const entryPrice = new Decimal(input.entryPrice);
  if (!quantity.isFinite() || !entryPrice.isFinite() || quantity.lte(0) || entryPrice.lte(0)) {
    throw new Error("الكمية وسعر الدخول يجب أن يكونا رقمين موجبين.");
  }

  const result = await db.insert(paperTrades).values({
    userId,
    symbol: input.symbol.toUpperCase(),
    exchange: input.exchange.toUpperCase(),
    assetClass: input.assetClass,
    side: input.side,
    quantity: quantity.toFixed(8),
    entryPrice: entryPrice.toFixed(8),
    stopLoss: input.stopLoss ? new Decimal(input.stopLoss).toFixed(8) : null,
    takeProfit: input.takeProfit ? new Decimal(input.takeProfit).toFixed(8) : null,
    note: input.note?.trim() || null,
  });
  return { id: Number(result[0].insertId) };
}

export async function closeUserPaperTrade(userId: number, tradeId: number, closePriceValue: string) {
  const db = await requireDb();
  const [trade] = await db
    .select()
    .from(paperTrades)
    .where(and(eq(paperTrades.id, tradeId), eq(paperTrades.userId, userId)))
    .limit(1);

  if (!trade) throw new Error("الصفقة غير موجودة أو لا تملك صلاحية الوصول إليها.");
  if (trade.status !== "open") throw new Error("لا يمكن إغلاق صفقة مغلقة مسبقًا.");

  const closePrice = new Decimal(closePriceValue);
  if (!closePrice.isFinite() || closePrice.lte(0)) throw new Error("سعر الإغلاق يجب أن يكون رقمًا موجبًا.");

  const realizedPnl = calculateRealizedPnl({
    side: trade.side,
    entryPrice: trade.entryPrice,
    exitPrice: closePrice.toString(),
    quantity: trade.quantity,
  });
  const closedAt = new Date();

  await db
    .update(paperTrades)
    .set({
      status: "closed",
      exitPrice: closePrice.toFixed(8),
      realizedPnl,
      closedAt,
    })
    .where(and(eq(paperTrades.id, tradeId), eq(paperTrades.userId, userId), eq(paperTrades.status, "open")));

  return { id: tradeId, exitPrice: closePrice.toFixed(8), realizedPnl, closedAt };
}

export async function createUserSignal(userId: number, input: Omit<InsertSavedSignal, "id" | "userId" | "createdAt">) {
  const db = await requireDb();
  const result = await db.insert(savedSignals).values({ ...input, userId });
  return { id: Number(result[0].insertId) };
}

export async function listUserSignals(userId: number) {
  const db = await requireDb();
  return db.select().from(savedSignals).where(eq(savedSignals.userId, userId)).orderBy(desc(savedSignals.createdAt));
}

export async function deleteUserSignal(userId: number, signalId: number) {
  const db = await requireDb();
  await db.delete(savedSignals).where(and(eq(savedSignals.id, signalId), eq(savedSignals.userId, userId)));
  return { success: true } as const;
}

export async function getMarketSnapshot(cacheKey: string) {
  const db = await getDb();
  if (!db) return undefined;
  const [snapshot] = await db.select().from(marketSnapshots).where(eq(marketSnapshots.cacheKey, cacheKey)).limit(1);
  if (!snapshot || snapshot.expiresAt <= new Date()) return undefined;
  return snapshot.payload;
}

export async function saveMarketSnapshot(input: {
  cacheKey: string;
  market: string;
  exchange: string;
  timeframe: string;
  payload: unknown;
  expiresAt: Date;
}) {
  const db = await getDb();
  if (!db) return;
  await db.insert(marketSnapshots).values(input).onDuplicateKeyUpdate({
    set: { payload: input.payload, fetchedAt: new Date(), expiresAt: input.expiresAt },
  });
}

export async function listUserWatchlist(userId: number) {
  const db = await requireDb();
  return db.select().from(watchlists).where(eq(watchlists.userId, userId)).orderBy(desc(watchlists.createdAt));
}

export type MetalAlertInput = {
  metal: "XAUUSD" | "XAGUSD";
  direction: "above" | "below";
  targetPrice: string;
};

export async function listUserMetalAlerts(userId: number) {
  const db = await requireDb();
  return db.select().from(metalAlerts).where(eq(metalAlerts.userId, userId)).orderBy(desc(metalAlerts.createdAt));
}

export async function createUserMetalAlert(userId: number, input: MetalAlertInput) {
  const db = await requireDb();
  const targetPrice = new Decimal(input.targetPrice);
  if (!targetPrice.isFinite() || targetPrice.lte(0)) throw new Error("سعر التنبيه يجب أن يكون رقمًا موجبًا.");
  const result = await db.insert(metalAlerts).values({
    userId,
    metal: input.metal,
    direction: input.direction,
    targetPrice: targetPrice.toFixed(4),
  });
  return { id: Number(result[0].insertId) };
}

export async function cancelUserMetalAlert(userId: number, alertId: number) {
  const db = await requireDb();
  await db.update(metalAlerts).set({ status: "cancelled" }).where(and(eq(metalAlerts.id, alertId), eq(metalAlerts.userId, userId), eq(metalAlerts.status, "active")));
  return { success: true } as const;
}

export async function listUserNotifications(userId: number) {
  const db = await requireDb();
  return db.select().from(userNotifications).where(eq(userNotifications.userId, userId)).orderBy(desc(userNotifications.createdAt)).limit(20);
}

export async function markUserNotificationRead(userId: number, notificationId: number) {
  const db = await requireDb();
  await db.update(userNotifications).set({ readAt: new Date() }).where(and(eq(userNotifications.id, notificationId), eq(userNotifications.userId, userId), isNull(userNotifications.readAt)));
  return { success: true } as const;
}

export async function getUserTelegramSettings(userId: number) {
  const db = await requireDb();
  const [settings] = await db.select().from(userTelegramSettings).where(eq(userTelegramSettings.userId, userId)).limit(1);
  return settings;
}

export async function saveUserTelegramSettings(userId: number, input: { enabled: boolean; chatId?: string | null }) {
  const db = await requireDb();
  const chatId = input.chatId?.trim() || null;
  if (input.enabled && !chatId) throw new Error("أدخل معرّف محادثة تيليغرام قبل التفعيل.");
  await db.insert(userTelegramSettings).values({ userId, chatId, enabled: input.enabled ? 1 : 0 }).onDuplicateKeyUpdate({ set: { chatId, enabled: input.enabled ? 1 : 0, updatedAt: new Date() } });
  return { enabled: input.enabled, chatId };
}

export async function getUserChartPreferences(userId: number) {
  const db = await requireDb();
  const [preferences] = await db.select().from(chartPreferences).where(eq(chartPreferences.userId, userId)).limit(1);
  return preferences;
}

export async function saveUserChartPreferences(userId: number, layers: Record<string, boolean>) {
  const db = await requireDb();
  await db.insert(chartPreferences).values({ userId, layers }).onDuplicateKeyUpdate({ set: { layers, updatedAt: new Date() } });
  return { layers };
}

export async function listActiveMetalAlerts() {
  const db = await requireDb();
  return db
    .select({ alert: metalAlerts, telegram: userTelegramSettings })
    .from(metalAlerts)
    .leftJoin(userTelegramSettings, eq(metalAlerts.userId, userTelegramSettings.userId))
    .where(eq(metalAlerts.status, "active"));
}

export async function markMetalAlertTriggered(alertId: number, price: string) {
  const db = await requireDb();
  const result = await db.update(metalAlerts).set({ status: "triggered", triggeredPrice: price, triggeredAt: new Date() }).where(and(eq(metalAlerts.id, alertId), eq(metalAlerts.status, "active")));
  return Number(result[0].affectedRows) > 0;
}

export async function createMetalAlertNotification(input: { userId: number; title: string; content: string; metadata: { alertId: number; metal: "XAUUSD" | "XAGUSD"; direction: "above" | "below"; targetPrice: string; triggeredPrice: string } }) {
  const db = await requireDb();
  await db.insert(userNotifications).values({ ...input, category: "metal_alert" });
}

export async function saveMetalAlertMonitorTaskUid(scheduleTaskUid: string) {
  const db = await requireDb();
  await db.insert(metalAlertMonitorSettings).values({ id: 1, scheduleTaskUid }).onDuplicateKeyUpdate({ set: { scheduleTaskUid, updatedAt: new Date() } });
}

export async function getMetalAlertMonitorTaskUid() {
  const db = await requireDb();
  const [settings] = await db.select().from(metalAlertMonitorSettings).where(eq(metalAlertMonitorSettings.id, 1)).limit(1);
  return settings?.scheduleTaskUid ?? null;
}

export type StructureAlertInput = {
  symbol: string;
  exchange: string;
  interval: "5m" | "15m" | "1h" | "4h" | "1d" | "1wk";
  eventType: "breakout" | "breakdown" | "bullish_reversal" | "bearish_reversal";
};

export async function listUserStructureAlerts(userId: number) {
  const db = await requireDb();
  return db.select().from(structureAlerts).where(eq(structureAlerts.userId, userId)).orderBy(desc(structureAlerts.createdAt));
}

export async function createUserStructureAlert(userId: number, input: StructureAlertInput) {
  const db = await requireDb();
  const result = await db.insert(structureAlerts).values({
    userId,
    symbol: input.symbol.trim().toUpperCase(),
    exchange: input.exchange.trim().toUpperCase(),
    interval: input.interval,
    eventType: input.eventType,
  });
  return { id: Number(result[0].insertId) };
}

export async function cancelUserStructureAlert(userId: number, alertId: number) {
  const db = await requireDb();
  await db.update(structureAlerts).set({ status: "cancelled" }).where(and(eq(structureAlerts.id, alertId), eq(structureAlerts.userId, userId), eq(structureAlerts.status, "active")));
  return { success: true } as const;
}

export async function listActiveStructureAlerts() {
  const db = await requireDb();
  return db
    .select({ alert: structureAlerts, telegram: userTelegramSettings })
    .from(structureAlerts)
    .leftJoin(userTelegramSettings, eq(structureAlerts.userId, userTelegramSettings.userId))
    .where(eq(structureAlerts.status, "active"));
}

export async function markStructureAlertTriggered(alertId: number, input: { price: string; eventKey: string; qualityScore: number }) {
  const db = await requireDb();
  const result = await db.update(structureAlerts).set({
    status: "triggered",
    triggeredPrice: input.price,
    triggeredEventKey: input.eventKey,
    qualityScore: input.qualityScore,
    triggeredAt: new Date(),
  }).where(and(eq(structureAlerts.id, alertId), eq(structureAlerts.status, "active")));
  return Number(result[0].affectedRows) > 0;
}

export async function createStructureAlertNotification(input: { userId: number; title: string; content: string; metadata: Record<string, unknown> }) {
  const db = await requireDb();
  await db.insert(userNotifications).values({ ...input, category: "structure_alert" });
}

import Decimal from "decimal.js";
import { and, desc, eq, inArray, isNull, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { randomUUID } from "node:crypto";
import {
  InsertSavedSignal,
  analysisExternalContextPreferences,
  aiConversationMessages,
  aiMemorySettings,
  chartPreferences,
  dailyMarketDigestMonitorSettings,
  economicCalendarDeliveryLog,
  economicCalendarMonitorSettings,
  economicCalendarSubscriptions,
  InsertUser,
  marketSnapshotCleanupMonitorSettings,
  marketPulsePreferences,
  marketSnapshots,
  metalAlertMonitorSettings,
  metalAlerts,
  orderFlowPreferences,
  structureAlerts,
  structureContextAlerts,
  paperTrades,
  paperTradeCritiques,
  paperTradingLeaderboardProfiles,
  savedSignals,
  userNotifications,
  userTelegramSettings,
  users,
  watchlists,
} from "../drizzle/schema";
import { ENV } from "./_core/env";
import { calculateRealizedPnl } from "./paperCalculations";
import { createMarketSnapshotL1Cache } from "./marketSnapshotL1";

let _db: ReturnType<typeof drizzle> | null = null;
const marketSnapshotL1 = createMarketSnapshotL1Cache(500);

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

export async function getUserClosedPaperTrade(userId: number, tradeId: number) {
  const db = await requireDb();
  const [trade] = await db.select().from(paperTrades).where(and(eq(paperTrades.id, tradeId), eq(paperTrades.userId, userId), eq(paperTrades.status, "closed"))).limit(1);
  return trade;
}

export async function getUserPaperTradeCritique(userId: number, tradeId: number) {
  const db = await requireDb();
  const [critique] = await db.select().from(paperTradeCritiques).where(and(eq(paperTradeCritiques.paperTradeId, tradeId), eq(paperTradeCritiques.userId, userId))).limit(1);
  return critique;
}

export async function saveUserPaperTradeCritique(userId: number, tradeId: number, content: Record<string, unknown>) {
  const db = await requireDb();
  await db.insert(paperTradeCritiques).values({ paperTradeId: tradeId, userId, content }).onDuplicateKeyUpdate({ set: { content, updatedAt: new Date() } });
  return { paperTradeId: tradeId, content };
}

export async function getPaperTradingLeaderboardProfile(userId: number) {
  const db = await requireDb();
  const [profile] = await db.select().from(paperTradingLeaderboardProfiles).where(eq(paperTradingLeaderboardProfiles.userId, userId)).limit(1);
  return profile;
}

export async function savePaperTradingLeaderboardProfile(userId: number, input: { enabled: boolean; displayName: string; anonymized: boolean }) {
  const db = await requireDb();
  await db.insert(paperTradingLeaderboardProfiles).values({ userId, enabled: input.enabled ? 1 : 0, displayName: input.displayName, anonymized: input.anonymized ? 1 : 0 }).onDuplicateKeyUpdate({ set: { enabled: input.enabled ? 1 : 0, displayName: input.displayName, anonymized: input.anonymized ? 1 : 0, updatedAt: new Date() } });
  return input;
}

export async function listPaperTradingLeaderboard() {
  const db = await requireDb();
  const rows = await db.select({ profile: paperTradingLeaderboardProfiles, trade: paperTrades }).from(paperTradingLeaderboardProfiles).leftJoin(paperTrades, and(eq(paperTradingLeaderboardProfiles.userId, paperTrades.userId), eq(paperTrades.status, "closed"))).where(eq(paperTradingLeaderboardProfiles.enabled, 1));
  type LeaderboardTrade = { entryPrice: string; exitPrice: string | null; side: "long" | "short"; realizedPnl: string | null };
  const grouped = new Map<number, { displayName: string; trades: LeaderboardTrade[] }>();
  for (const row of rows) {
    const entry = grouped.get(row.profile.userId) ?? { displayName: row.profile.anonymized ? "متداول مجهول" : row.profile.displayName, trades: [] };
    if (row.trade) entry.trades.push(row.trade);
    grouped.set(row.profile.userId, entry);
  }
  const leaderboard: Array<{ displayName: string; totalTrades: number; winRate: number; totalReturnPercent: number; realizedPnl: string }> = [];
  grouped.forEach((entry: { displayName: string; trades: LeaderboardTrade[] }) => {
    const closed: LeaderboardTrade[] = entry.trades.filter((trade: LeaderboardTrade) => Boolean(trade.exitPrice));
    const wins = closed.filter((trade: LeaderboardTrade) => new Decimal(trade.realizedPnl ?? "0").gt(0)).length;
    const returnPercent = closed.reduce((total: Decimal, trade: LeaderboardTrade) => {
      const entryPrice = new Decimal(trade.entryPrice);
      const exitPrice = new Decimal(trade.exitPrice ?? trade.entryPrice);
      const movement = trade.side === "long" ? exitPrice.minus(entryPrice) : entryPrice.minus(exitPrice);
      return total.plus(movement.div(entryPrice).mul(100));
    }, new Decimal(0));
    const realizedPnl = closed.reduce((total: Decimal, trade: LeaderboardTrade) => total.plus(new Decimal(trade.realizedPnl ?? "0")), new Decimal(0));
    if (closed.length) leaderboard.push({ displayName: entry.displayName, totalTrades: closed.length, winRate: Number((wins / closed.length * 100).toFixed(1)), totalReturnPercent: Number(returnPercent.toFixed(2)), realizedPnl: realizedPnl.toFixed(4) });
  });
  return leaderboard.sort((a, b) => b.totalReturnPercent - a.totalReturnPercent).slice(0, 50);
}

export async function getUserPaperTradingSummary(userId: number) {
  const trades = await listUserPaperTrades(userId);
  const closedTrades = trades.filter(trade => trade.status === "closed");
  const realizedPnl = closedTrades.reduce((total, trade) => total.plus(new Decimal(trade.realizedPnl ?? "0")), new Decimal(0));
  const wins = closedTrades.filter(trade => new Decimal(trade.realizedPnl ?? "0").gt(0)).length;
  const losses = closedTrades.filter(trade => new Decimal(trade.realizedPnl ?? "0").lt(0)).length;
  return {
    totalTrades: trades.length,
    openTrades: trades.length - closedTrades.length,
    closedTrades: closedTrades.length,
    wins,
    losses,
    winRate: closedTrades.length ? Number(((wins / closedTrades.length) * 100).toFixed(1)) : null,
    realizedPnl: realizedPnl.toFixed(8),
  };
}

export async function createUserSignal(userId: number, input: Omit<InsertSavedSignal, "id" | "userId" | "createdAt" | "publicShareId">, sharePublic = false) {
  const db = await requireDb();
  const publicShareId = sharePublic ? randomUUID() : null;
  const result = await db.insert(savedSignals).values({ ...input, userId, publicShareId });
  return { id: Number(result[0].insertId), publicShareId };
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

export async function enablePublicSignalShare(userId: number, signalId: number) {
  const db = await requireDb();
  const [signal] = await db.select({ publicShareId: savedSignals.publicShareId }).from(savedSignals).where(and(eq(savedSignals.id, signalId), eq(savedSignals.userId, userId))).limit(1);
  if (!signal) return null;
  if (signal.publicShareId) return { publicShareId: signal.publicShareId };
  const publicShareId = randomUUID();
  await db.update(savedSignals).set({ publicShareId }).where(and(eq(savedSignals.id, signalId), eq(savedSignals.userId, userId)));
  return { publicShareId };
}

/** إسقاط مقصود للبيانات: لا يعيد userId أو البريد أو غلاف التحليل الخاص في الرابط العام. */
export async function getPublicSignal(publicShareId: string) {
  const db = await getDb();
  if (!db) return null;
  const [signal] = await db.select({
    symbol: savedSignals.symbol,
    exchange: savedSignals.exchange,
    timeframe: savedSignals.timeframe,
    recommendation: savedSignals.recommendation,
    confidence: savedSignals.confidence,
    summary: savedSignals.summary,
    createdAt: savedSignals.createdAt,
  }).from(savedSignals).where(eq(savedSignals.publicShareId, publicShareId)).limit(1);
  return signal ?? null;
}

export async function getMarketSnapshot(cacheKey: string) {
  const inMemory = marketSnapshotL1.get(cacheKey);
  if (inMemory !== undefined) return inMemory;
  const db = await getDb();
  if (!db) return undefined;
  const [snapshot] = await db.select().from(marketSnapshots).where(eq(marketSnapshots.cacheKey, cacheKey)).limit(1);
  if (!snapshot || snapshot.expiresAt <= new Date()) return undefined;
  marketSnapshotL1.set(cacheKey, snapshot.payload, snapshot.expiresAt);
  return snapshot.payload;
}

/** نحتفظ باللقطات المنتهية ليوم إضافي لتسهيل التشخيص قبل التنظيف الدوري. */
export const MARKET_SNAPSHOT_CLEANUP_RETENTION_MS = 24 * 60 * 60 * 1_000;

export function getMarketSnapshotCleanupCutoff(now = new Date()) {
  return new Date(now.getTime() - MARKET_SNAPSHOT_CLEANUP_RETENTION_MS);
}

export function shouldCleanupMarketSnapshot(expiresAt: Date, now = new Date()) {
  return expiresAt.getTime() < getMarketSnapshotCleanupCutoff(now).getTime();
}

type MarketSnapshotCleanupDb = {
  delete: (table: typeof marketSnapshots) => {
    where: (condition: unknown) => Promise<unknown>;
  };
};

/**
 * يحذف فقط لقطات الكاش المنتهية منذ أكثر من يوم. يُقبل db اختياريًا للاختبار
 * دون الحاجة إلى قاعدة بيانات فعلية؛ المسار التشغيلي يستعمل اتصال Drizzle المعتاد.
 */
export async function cleanupExpiredMarketSnapshots(options: { now?: Date; db?: MarketSnapshotCleanupDb } = {}) {
  const cutoff = getMarketSnapshotCleanupCutoff(options.now);
  const db = options.db ?? await getDb();
  if (!db) return 0;
  const result = await db.delete(marketSnapshots).where(lt(marketSnapshots.expiresAt, cutoff));
  return Number((result as Array<{ affectedRows?: number }>)[0]?.affectedRows ?? 0);
}

const MAX_ASSISTANT_MEMORY_MESSAGES = 12;
const MAX_STORED_ASSISTANT_MEMORY_MESSAGES = 24;

export type AssistantMemoryMessage = { role: "user" | "assistant"; content: string };

export async function getUserAssistantMemory(userId: number) {
  const db = await getDb();
  if (!db) return { enabled: false, messages: [] as AssistantMemoryMessage[] };

  const [settings] = await db.select().from(aiMemorySettings).where(eq(aiMemorySettings.userId, userId)).limit(1);
  if (!settings?.enabled) return { enabled: false, messages: [] as AssistantMemoryMessage[] };

  const messages = await db
    .select({ role: aiConversationMessages.role, content: aiConversationMessages.content })
    .from(aiConversationMessages)
    .where(eq(aiConversationMessages.userId, userId))
    .orderBy(desc(aiConversationMessages.createdAt), desc(aiConversationMessages.id))
    .limit(MAX_ASSISTANT_MEMORY_MESSAGES);

  return { enabled: true, messages: messages.reverse() as AssistantMemoryMessage[] };
}

export async function setUserAssistantMemoryEnabled(userId: number, enabled: boolean) {
  const db = await requireDb();
  await db.insert(aiMemorySettings).values({ userId, enabled: enabled ? 1 : 0 }).onDuplicateKeyUpdate({
    set: { enabled: enabled ? 1 : 0, updatedAt: new Date() },
  });
  return { enabled };
}

export async function clearUserAssistantMemory(userId: number) {
  const db = await requireDb();
  await db.delete(aiConversationMessages).where(eq(aiConversationMessages.userId, userId));
  return { success: true } as const;
}

export async function appendUserAssistantMemory(userId: number, messages: AssistantMemoryMessage[]) {
  const db = await getDb();
  if (!db || messages.length === 0) return;

  const safeMessages = messages
    .map(message => ({ role: message.role, content: message.content.trim().slice(0, 8_000) }))
    .filter(message => message.content.length > 0);
  if (safeMessages.length === 0) return;

  await db.insert(aiConversationMessages).values(safeMessages.map(message => ({ userId, ...message })));
  const retained = await db
    .select({ id: aiConversationMessages.id })
    .from(aiConversationMessages)
    .where(eq(aiConversationMessages.userId, userId))
    .orderBy(desc(aiConversationMessages.createdAt), desc(aiConversationMessages.id))
    .limit(MAX_STORED_ASSISTANT_MEMORY_MESSAGES + 1);
  const outdatedIds = retained.slice(MAX_STORED_ASSISTANT_MEMORY_MESSAGES).map(row => row.id);
  if (outdatedIds.length > 0) {
    await db.delete(aiConversationMessages).where(and(eq(aiConversationMessages.userId, userId), inArray(aiConversationMessages.id, outdatedIds)));
  }
}

export async function saveMarketSnapshot(input: {
  cacheKey: string;
  market: string;
  exchange: string;
  timeframe: string;
  payload: unknown;
  expiresAt: Date;
}) {
  marketSnapshotL1.set(input.cacheKey, input.payload, input.expiresAt);
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

export async function addUserWatchlistItem(userId: number, input: { symbol: string; exchange: string; assetClass: "crypto" | "stock" | "forex" | "futures" }) {
  const db = await requireDb();
  await db.insert(watchlists).values({ userId, ...input }).onDuplicateKeyUpdate({ set: { assetClass: input.assetClass } });
  return listUserWatchlist(userId);
}

export async function removeUserWatchlistItem(userId: number, symbol: string, exchange: string) {
  const db = await requireDb();
  await db.delete(watchlists).where(and(eq(watchlists.userId, userId), eq(watchlists.symbol, symbol), eq(watchlists.exchange, exchange)));
  return listUserWatchlist(userId);
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

export async function getEconomicCalendarSubscription(userId: number) {
  const db = await requireDb();
  const [subscription] = await db.select().from(economicCalendarSubscriptions).where(eq(economicCalendarSubscriptions.userId, userId)).limit(1);
  return subscription;
}

export async function saveEconomicCalendarSubscription(userId: number, input: { enabled: boolean; highImpactOnly: boolean; countries: string[]; preAlertMinutes: number }) {
  const db = await requireDb();
  const countries = Array.from(new Set(input.countries.map(country => country.trim()).filter(Boolean))).slice(0, 10);
  if (input.enabled && !countries.length) throw new Error("اختر بلدًا واحدًا على الأقل لاشتراك التقويم.");
  await db.insert(economicCalendarSubscriptions).values({ userId, enabled: input.enabled ? 1 : 0, highImpactOnly: input.highImpactOnly ? 1 : 0, countries, preAlertMinutes: input.preAlertMinutes }).onDuplicateKeyUpdate({ set: { enabled: input.enabled ? 1 : 0, highImpactOnly: input.highImpactOnly ? 1 : 0, countries, preAlertMinutes: input.preAlertMinutes, updatedAt: new Date() } });
  return { enabled: input.enabled, highImpactOnly: input.highImpactOnly, countries, preAlertMinutes: input.preAlertMinutes };
}

export async function saveDailyMarketDigestSubscription(userId: number, enabled: boolean) {
  const db = await requireDb();
  await db.insert(economicCalendarSubscriptions).values({ userId, enabled: 0, dailyDigestEnabled: enabled ? 1 : 0, highImpactOnly: 1, countries: ["United States"], preAlertMinutes: 60 }).onDuplicateKeyUpdate({ set: { dailyDigestEnabled: enabled ? 1 : 0, updatedAt: new Date() } });
  return { enabled };
}

export async function listActiveDailyMarketDigestSubscriptions() {
  const db = await requireDb();
  return db.select({ subscription: economicCalendarSubscriptions, telegram: userTelegramSettings }).from(economicCalendarSubscriptions).leftJoin(userTelegramSettings, eq(economicCalendarSubscriptions.userId, userTelegramSettings.userId)).where(eq(economicCalendarSubscriptions.dailyDigestEnabled, 1));
}

export async function listActiveEconomicCalendarSubscriptions() {
  const db = await requireDb();
  return db.select({ subscription: economicCalendarSubscriptions, telegram: userTelegramSettings }).from(economicCalendarSubscriptions).leftJoin(userTelegramSettings, eq(economicCalendarSubscriptions.userId, userTelegramSettings.userId)).where(eq(economicCalendarSubscriptions.enabled, 1));
}

export async function recordEconomicCalendarDelivery(userId: number, eventId: string) {
  const db = await requireDb();
  try {
    await db.insert(economicCalendarDeliveryLog).values({ userId, eventId });
    return true;
  } catch (error) {
    const code = error && typeof error === "object" && "code" in error ? (error as { code?: string }).code : undefined;
    if (code === "ER_DUP_ENTRY") return false;
    throw error;
  }
}

export async function saveEconomicCalendarMonitorTaskUid(scheduleTaskUid: string) {
  const db = await requireDb();
  await db.insert(economicCalendarMonitorSettings).values({ id: 1, scheduleTaskUid }).onDuplicateKeyUpdate({ set: { scheduleTaskUid, updatedAt: new Date() } });
}

export async function getEconomicCalendarMonitorTaskUid() {
  const db = await requireDb();
  const [settings] = await db.select().from(economicCalendarMonitorSettings).where(eq(economicCalendarMonitorSettings.id, 1)).limit(1);
  return settings?.scheduleTaskUid ?? null;
}

export async function saveDailyMarketDigestMonitorTaskUid(scheduleTaskUid: string) {
  const db = await requireDb();
  await db.insert(dailyMarketDigestMonitorSettings).values({ id: 1, scheduleTaskUid }).onDuplicateKeyUpdate({ set: { scheduleTaskUid, updatedAt: new Date() } });
}

export async function getDailyMarketDigestMonitorTaskUid() {
  const db = await requireDb();
  const [settings] = await db.select().from(dailyMarketDigestMonitorSettings).where(eq(dailyMarketDigestMonitorSettings.id, 1)).limit(1);
  return settings?.scheduleTaskUid ?? null;
}

export async function saveMarketSnapshotCleanupMonitorTaskUid(scheduleTaskUid: string) {
  const db = await requireDb();
  await db.insert(marketSnapshotCleanupMonitorSettings).values({ id: 1, scheduleTaskUid }).onDuplicateKeyUpdate({ set: { scheduleTaskUid, updatedAt: new Date() } });
}

export async function getMarketSnapshotCleanupMonitorTaskUid() {
  const db = await requireDb();
  const [settings] = await db.select().from(marketSnapshotCleanupMonitorSettings).where(eq(marketSnapshotCleanupMonitorSettings.id, 1)).limit(1);
  return settings?.scheduleTaskUid ?? null;
}

export async function getUserChartPreferences(userId: number) {
  const db = await requireDb();
  const [preferences] = await db.select().from(chartPreferences).where(eq(chartPreferences.userId, userId)).limit(1);
  return preferences;
}

export async function saveUserChartPreferences(userId: number, preferences: Record<string, unknown>) {
  const db = await requireDb();
  await db.insert(chartPreferences).values({ userId, layers: preferences }).onDuplicateKeyUpdate({ set: { layers: preferences, updatedAt: new Date() } });
  return { layers: preferences };
}

export async function getUserOrderFlowPreferences(userId: number) {
  const db = await requireDb();
  const [preferences] = await db.select().from(orderFlowPreferences).where(eq(orderFlowPreferences.userId, userId)).limit(1);
  return preferences;
}

export async function saveUserOrderFlowPreferences(userId: number, preferences: { largeTradeMinNotional: number; depthLevels: number }) {
  const db = await requireDb();
  await db.insert(orderFlowPreferences).values({ userId, ...preferences }).onDuplicateKeyUpdate({
    set: { ...preferences, updatedAt: new Date() },
  });
}

export async function getUserMarketPulsePreferences(userId: number) {
  const db = await requireDb();
  const [preferences] = await db.select().from(marketPulsePreferences).where(eq(marketPulsePreferences.userId, userId)).limit(1);
  return preferences;
}

export async function saveUserMarketPulsePreferences(userId: number, sections: string[]) {
  const db = await requireDb();
  await db.insert(marketPulsePreferences).values({ userId, sections }).onDuplicateKeyUpdate({ set: { sections, updatedAt: new Date() } });
  return { sections };
}

export async function getUserAnalysisExternalContextPreferences(userId: number) {
  const db = await requireDb();
  const [preferences] = await db.select().from(analysisExternalContextPreferences).where(eq(analysisExternalContextPreferences.userId, userId)).limit(1);
  return preferences;
}

export async function saveUserAnalysisExternalContextPreferences(userId: number, references: Array<{ symbol: string; exchange: string }>) {
  const db = await requireDb();
  await db.insert(analysisExternalContextPreferences).values({ userId, references }).onDuplicateKeyUpdate({ set: { references, updatedAt: new Date() } });
  return { references };
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

export type StructureContextAlertInput = {
  symbol: string;
  exchange: string;
  interval: "5m" | "15m" | "1h" | "4h" | "1d" | "1wk";
  sourceKind: "support" | "resistance" | "demand_zone" | "supply_zone";
  sourceLabel: string;
  referencePrice: string;
  rangeLow?: string | null;
  rangeHigh?: string | null;
  invalidationPrice?: string | null;
  eventType: "approach" | "touch" | "invalidation";
  proximityBps?: number;
};

function normalizeContextAlertPrice(value: string | null | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const price = new Decimal(value);
  if (!price.isFinite() || price.lte(0)) throw new Error("سعر تنبيه السياق يجب أن يكون رقمًا موجبًا.");
  return price.toFixed(8);
}

export async function listUserStructureContextAlerts(userId: number) {
  const db = await requireDb();
  return db.select().from(structureContextAlerts).where(eq(structureContextAlerts.userId, userId)).orderBy(desc(structureContextAlerts.createdAt));
}

export async function createUserStructureContextAlert(userId: number, input: StructureContextAlertInput) {
  const db = await requireDb();
  const referencePrice = normalizeContextAlertPrice(input.referencePrice);
  const rangeLow = normalizeContextAlertPrice(input.rangeLow);
  const rangeHigh = normalizeContextAlertPrice(input.rangeHigh);
  const invalidationPrice = normalizeContextAlertPrice(input.invalidationPrice);
  if (!referencePrice) throw new Error("سعر المستوى أو المنطقة مطلوب.");
  if ((rangeLow && !rangeHigh) || (!rangeLow && rangeHigh)) throw new Error("نطاق المنطقة يحتاج حدًا أدنى وأعلى.");
  if (rangeLow && rangeHigh && new Decimal(rangeLow).gt(rangeHigh)) throw new Error("الحد الأدنى للمنطقة يجب ألا يتجاوز الحد الأعلى.");
  if (input.eventType === "invalidation" && !invalidationPrice) throw new Error("تنبيه الإبطال يحتاج سعر إبطال واضحًا.");
  const result = await db.insert(structureContextAlerts).values({
    userId,
    ...input,
    symbol: input.symbol.trim().toUpperCase(),
    exchange: input.exchange.trim().toUpperCase(),
    sourceLabel: input.sourceLabel.trim().slice(0, 160),
    referencePrice,
    rangeLow,
    rangeHigh,
    invalidationPrice,
    proximityBps: Math.max(1, Math.min(100, input.proximityBps ?? 15)),
  });
  return { id: Number(result[0].insertId) };
}

export async function cancelUserStructureContextAlert(userId: number, alertId: number) {
  const db = await requireDb();
  await db.update(structureContextAlerts).set({ status: "cancelled" }).where(and(eq(structureContextAlerts.id, alertId), eq(structureContextAlerts.userId, userId), eq(structureContextAlerts.status, "active")));
  return { success: true } as const;
}

export async function listActiveStructureContextAlerts() {
  const db = await requireDb();
  return db.select({ alert: structureContextAlerts, telegram: userTelegramSettings }).from(structureContextAlerts).leftJoin(userTelegramSettings, eq(structureContextAlerts.userId, userTelegramSettings.userId)).where(eq(structureContextAlerts.status, "active"));
}

export async function markStructureContextAlertTriggered(alertId: number, price: string) {
  const db = await requireDb();
  const result = await db.update(structureContextAlerts).set({ status: "triggered", triggeredPrice: price, triggeredAt: new Date() }).where(and(eq(structureContextAlerts.id, alertId), eq(structureContextAlerts.status, "active")));
  return Number(result[0].affectedRows) > 0;
}

export async function createStructureContextAlertNotification(input: { userId: number; title: string; content: string; metadata: Record<string, unknown> }) {
  const db = await requireDb();
  await db.insert(userNotifications).values({ ...input, category: "structure_context_alert" });
}

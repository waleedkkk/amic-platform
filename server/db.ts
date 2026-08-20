import Decimal from "decimal.js";
import { and, desc, eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import {
  InsertSavedSignal,
  InsertUser,
  marketSnapshots,
  paperTrades,
  savedSignals,
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

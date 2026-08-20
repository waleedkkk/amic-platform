import {
  decimal,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

// Local email/password auth fields. legacy openId rows keep working but the
// primary auth path is now email + password (passwordHash stored as bcrypt).
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const watchlists = mysqlTable(
  "watchlists",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 64 }).notNull(),
    exchange: varchar("exchange", { length: 32 }).notNull(),
    assetClass: mysqlEnum("assetClass", ["crypto", "stock", "forex", "futures"]).notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerLookup: index("watchlists_user_idx").on(table.userId),
    uniqueAsset: uniqueIndex("watchlists_user_symbol_exchange_uq").on(table.userId, table.symbol, table.exchange),
  }),
);

export const paperTrades = mysqlTable(
  "paperTrades",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 64 }).notNull(),
    exchange: varchar("exchange", { length: 32 }).notNull(),
    assetClass: mysqlEnum("assetClass", ["crypto", "stock", "forex", "futures"]).notNull(),
    side: mysqlEnum("side", ["long", "short"]).notNull(),
    status: mysqlEnum("status", ["open", "closed"]).default("open").notNull(),
    quantity: decimal("quantity", { precision: 24, scale: 8 }).notNull(),
    entryPrice: decimal("entryPrice", { precision: 24, scale: 8 }).notNull(),
    exitPrice: decimal("exitPrice", { precision: 24, scale: 8 }),
    stopLoss: decimal("stopLoss", { precision: 24, scale: 8 }),
    takeProfit: decimal("takeProfit", { precision: 24, scale: 8 }),
    realizedPnl: decimal("realizedPnl", { precision: 24, scale: 8 }),
    note: text("note"),
    openedAt: timestamp("openedAt").defaultNow().notNull(),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userStatusLookup: index("paper_trades_user_status_idx").on(table.userId, table.status),
    userCreatedLookup: index("paper_trades_user_created_idx").on(table.userId, table.createdAt),
  }),
);

export const savedSignals = mysqlTable(
  "savedSignals",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 64 }).notNull(),
    exchange: varchar("exchange", { length: 32 }).notNull(),
    timeframe: varchar("timeframe", { length: 8 }).notNull(),
    recommendation: mysqlEnum("recommendation", ["strong_buy", "buy", "neutral", "sell", "strong_sell"]).notNull(),
    confidence: int("confidence").notNull(),
    summary: text("summary").notNull(),
    analysisPayload: json("analysisPayload").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userHistoryLookup: index("saved_signals_user_created_idx").on(table.userId, table.createdAt),
  }),
);

export const marketSnapshots = mysqlTable(
  "marketSnapshots",
  {
    id: int("id").autoincrement().primaryKey(),
    cacheKey: varchar("cacheKey", { length: 160 }).notNull().unique(),
    market: varchar("market", { length: 32 }).notNull(),
    exchange: varchar("exchange", { length: 32 }).notNull(),
    timeframe: varchar("timeframe", { length: 8 }).notNull(),
    payload: json("payload").notNull(),
    fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
  },
  table => ({
    expiryLookup: index("market_snapshots_expiry_idx").on(table.expiresAt),
  }),
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PaperTrade = typeof paperTrades.$inferSelect;
export type InsertPaperTrade = typeof paperTrades.$inferInsert;
export type SavedSignal = typeof savedSignals.$inferSelect;
export type InsertSavedSignal = typeof savedSignals.$inferInsert;

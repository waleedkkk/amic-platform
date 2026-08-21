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

export const aiProviderSettings = mysqlTable(
  "aiProviderSettings",
  {
    id: int("id").autoincrement().primaryKey(),
    provider: varchar("provider", { length: 32 }).notNull(),
    encryptedApiKey: text("encryptedApiKey"),
    keyHint: varchar("keyHint", { length: 16 }),
    model: varchar("model", { length: 128 }).notNull(),
    customBaseUrl: varchar("customBaseUrl", { length: 512 }),
    maxOutputTokens: int("maxOutputTokens").default(900).notNull(),
    enabled: int("enabled").default(0).notNull(),
    isActive: int("isActive").default(0).notNull(),
    updatedByUserId: int("updatedByUserId").references(() => users.id, { onDelete: "set null" }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    providerUnique: uniqueIndex("ai_provider_settings_provider_uq").on(table.provider),
    activeLookup: index("ai_provider_settings_active_idx").on(table.isActive, table.enabled),
  }),
);

export const metalAlerts = mysqlTable(
  "metalAlerts",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    metal: mysqlEnum("metal", ["XAUUSD", "XAGUSD"]).notNull(),
    direction: mysqlEnum("direction", ["above", "below"]).notNull(),
    targetPrice: decimal("targetPrice", { precision: 18, scale: 4 }).notNull(),
    status: mysqlEnum("status", ["active", "triggered", "cancelled"]).default("active").notNull(),
    triggeredPrice: decimal("triggeredPrice", { precision: 18, scale: 4 }),
    triggeredAt: timestamp("triggeredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
  table => ({
    userStatusLookup: index("metal_alerts_user_status_idx").on(table.userId, table.status),
    monitorLookup: index("metal_alerts_monitor_idx").on(table.status, table.metal),
  }),
);

export const userNotifications = mysqlTable(
  "userNotifications",
  {
    id: int("id").autoincrement().primaryKey(),
    userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
    category: mysqlEnum("category", ["metal_alert"]).notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    content: text("content").notNull(),
    metadata: json("metadata").notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userReadLookup: index("user_notifications_user_read_idx").on(table.userId, table.readAt, table.createdAt),
  }),
);

export const userTelegramSettings = mysqlTable(
  "userTelegramSettings",
  {
    userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
    chatId: varchar("chatId", { length: 64 }),
    enabled: int("enabled").default(0).notNull(),
    updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  },
);

export const chartPreferences = mysqlTable("chartPreferences", {
  userId: int("userId").primaryKey().references(() => users.id, { onDelete: "cascade" }),
  layers: json("layers").notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const metalAlertMonitorSettings = mysqlTable("metalAlertMonitorSettings", {
  id: int("id").primaryKey(),
  scheduleTaskUid: varchar("scheduleTaskUid", { length: 65 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PaperTrade = typeof paperTrades.$inferSelect;
export type InsertPaperTrade = typeof paperTrades.$inferInsert;
export type SavedSignal = typeof savedSignals.$inferSelect;
export type InsertSavedSignal = typeof savedSignals.$inferInsert;
export type AiProviderSetting = typeof aiProviderSettings.$inferSelect;
export type MetalAlert = typeof metalAlerts.$inferSelect;
export type UserNotification = typeof userNotifications.$inferSelect;
export type ChartPreferences = typeof chartPreferences.$inferSelect;

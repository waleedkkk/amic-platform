import {
  decimal,
  index,
  integer,
  jsonb,
  serial,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const userRoleEnum = pgEnum("user_role", ["user", "admin"]);
export const assetClassEnum = pgEnum("asset_class", [
  "crypto",
  "stock",
  "forex",
  "futures",
]);
export const tradeSideEnum = pgEnum("trade_side", ["long", "short"]);
export const tradeStatusEnum = pgEnum("trade_status", ["open", "closed"]);
export const recommendationEnum = pgEnum("signal_recommendation", [
  "strong_buy",
  "buy",
  "neutral",
  "sell",
  "strong_sell",
]);
export const aiMessageRoleEnum = pgEnum("ai_message_role", [
  "user",
  "assistant",
]);
export const metalEnum = pgEnum("metal_symbol", ["XAUUSD", "XAGUSD"]);
export const metalAlertDirectionEnum = pgEnum("metal_alert_direction", [
  "above",
  "below",
]);
export const metalAlertStatusEnum = pgEnum("metal_alert_status", [
  "active",
  "triggered",
  "cancelled",
]);
export const alertIntervalEnum = pgEnum("alert_interval", [
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
  "1wk",
]);
export const structureEventEnum = pgEnum("structure_event_type", [
  "breakout",
  "breakdown",
  "bullish_reversal",
  "bearish_reversal",
]);
export const structureAlertStatusEnum = pgEnum("structure_alert_status", [
  "active",
  "triggered",
  "cancelled",
]);
export const contextSourceKindEnum = pgEnum("context_source_kind", [
  "support",
  "resistance",
  "demand_zone",
  "supply_zone",
]);
export const contextEventTypeEnum = pgEnum("context_event_type", [
  "approach",
  "touch",
  "invalidation",
]);
export const contextAlertStatusEnum = pgEnum("context_alert_status", [
  "active",
  "triggered",
  "cancelled",
]);
export const notificationCategoryEnum = pgEnum("notification_category", [
  "metal_alert",
  "structure_alert",
  "structure_context_alert",
]);

// Local email/password auth fields. legacy openId rows keep working but the
// primary auth path is now email + password (passwordHash stored as bcrypt).
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  openId: varchar("openId", { length: 64 }).unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }).unique(),
  passwordHash: varchar("passwordHash", { length: 255 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: userRoleEnum("role").default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export const watchlists = pgTable(
  "watchlists",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 64 }).notNull(),
    exchange: varchar("exchange", { length: 32 }).notNull(),
    assetClass: assetClassEnum("assetClass").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    ownerLookup: index("watchlists_user_idx").on(table.userId),
    uniqueAsset: uniqueIndex("watchlists_user_symbol_exchange_uq").on(
      table.userId,
      table.symbol,
      table.exchange
    ),
  })
);

export const paperTrades = pgTable(
  "paperTrades",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    signalId: integer("signalId").references(() => savedSignals.id, {
      onDelete: "set null",
    }),
    symbol: varchar("symbol", { length: 64 }).notNull(),
    exchange: varchar("exchange", { length: 32 }).notNull(),
    assetClass: assetClassEnum("assetClass").notNull(),
    side: tradeSideEnum("side").notNull(),
    status: tradeStatusEnum("status").default("open").notNull(),
    quantity: decimal("quantity", { precision: 24, scale: 8 }).notNull(),
    entryPrice: decimal("entryPrice", { precision: 24, scale: 8 }).notNull(),
    exitPrice: decimal("exitPrice", { precision: 24, scale: 8 }),
    stopLoss: decimal("stopLoss", { precision: 24, scale: 8 }),
    takeProfit: decimal("takeProfit", { precision: 24, scale: 8 }),
    referencePriceAtClose: decimal("referencePriceAtClose", {
      precision: 24,
      scale: 8,
    }),
    priceDeviationPercent: decimal("priceDeviationPercent", {
      precision: 10,
      scale: 4,
    }),
    priceDeviationWarning: integer("priceDeviationWarning")
      .default(0)
      .notNull(),
    realizedPnl: decimal("realizedPnl", { precision: 24, scale: 8 }),
    note: text("note"),
    openedAt: timestamp("openedAt").defaultNow().notNull(),
    closedAt: timestamp("closedAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => ({
    userStatusLookup: index("paper_trades_user_status_idx").on(
      table.userId,
      table.status
    ),
    userCreatedLookup: index("paper_trades_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
    signalLookup: index("paper_trades_signal_idx").on(table.signalId),
  })
);

export const paperTradeCritiques = pgTable(
  "paperTradeCritiques",
  {
    paperTradeId: integer("paperTradeId")
      .primaryKey()
      .references(() => paperTrades.id, { onDelete: "cascade" }),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    content: jsonb("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => ({
    userLookup: index("paper_trade_critiques_user_idx").on(table.userId),
  })
);

export const paperTradingLeaderboardProfiles = pgTable(
  "paperTradingLeaderboardProfiles",
  {
    userId: integer("userId")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    enabled: integer("enabled").default(0).notNull(),
    displayName: varchar("displayName", { length: 40 }).notNull(),
    anonymized: integer("anonymized").default(0).notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

export const savedSignals = pgTable(
  "savedSignals",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 64 }).notNull(),
    exchange: varchar("exchange", { length: 32 }).notNull(),
    timeframe: varchar("timeframe", { length: 8 }).notNull(),
    recommendation: recommendationEnum("recommendation").notNull(),
    confidence: integer("confidence").notNull(),
    summary: text("summary").notNull(),
    analysisPayload: jsonb("analysisPayload").notNull(),
    publicShareId: varchar("publicShareId", { length: 36 }).unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userHistoryLookup: index("saved_signals_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export const marketSnapshots = pgTable(
  "marketSnapshots",
  {
    id: serial("id").primaryKey(),
    cacheKey: varchar("cacheKey", { length: 160 }).notNull().unique(),
    market: varchar("market", { length: 32 }).notNull(),
    exchange: varchar("exchange", { length: 32 }).notNull(),
    timeframe: varchar("timeframe", { length: 8 }).notNull(),
    payload: jsonb("payload").notNull(),
    fetchedAt: timestamp("fetchedAt").defaultNow().notNull(),
    expiresAt: timestamp("expiresAt").notNull(),
  },
  table => ({
    expiryLookup: index("market_snapshots_expiry_idx").on(table.expiresAt),
  })
);

export const aiProviderSettings = pgTable(
  "aiProviderSettings",
  {
    id: serial("id").primaryKey(),
    provider: varchar("provider", { length: 32 }).notNull(),
    encryptedApiKey: text("encryptedApiKey"),
    keyHint: varchar("keyHint", { length: 16 }),
    model: varchar("model", { length: 128 }).notNull(),
    customBaseUrl: varchar("customBaseUrl", { length: 512 }),
    maxOutputTokens: integer("maxOutputTokens").default(900).notNull(),
    enabled: integer("enabled").default(0).notNull(),
    isActive: integer("isActive").default(0).notNull(),
    updatedByUserId: integer("updatedByUserId").references(() => users.id, {
      onDelete: "set null",
    }),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => ({
    providerUnique: uniqueIndex("ai_provider_settings_provider_uq").on(
      table.provider
    ),
    activeLookup: index("ai_provider_settings_active_idx").on(
      table.isActive,
      table.enabled
    ),
    updatedByLookup: index("ai_provider_settings_updated_by_idx").on(
      table.updatedByUserId
    ),
  })
);

/** أحداث استخدام مجردة؛ لا تحفظ نص المحادثة أو المفاتيح أو هوية المستخدم. */
export const aiModelUsageEvents = pgTable(
  "aiModelUsageEvents",
  {
    id: serial("id").primaryKey(),
    provider: varchar("provider", { length: 32 }).notNull(),
    model: varchar("model", { length: 128 }).notNull(),
    inputTokens: integer("inputTokens"),
    outputTokens: integer("outputTokens"),
    totalTokens: integer("totalTokens"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    createdLookup: index("ai_model_usage_created_idx").on(table.createdAt),
    modelCreatedLookup: index("ai_model_usage_provider_model_created_idx").on(
      table.provider,
      table.model,
      table.createdAt
    ),
  })
);

export const aiMemorySettings = pgTable("aiMemorySettings", {
  userId: integer("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  enabled: integer("enabled").default(0).notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const aiConversationMessages = pgTable(
  "aiConversationMessages",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: aiMessageRoleEnum("role").notNull(),
    content: text("content").notNull(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userCreatedLookup: index("ai_conversation_messages_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  })
);

export const metalAlerts = pgTable(
  "metalAlerts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    metal: metalEnum("metal").notNull(),
    direction: metalAlertDirectionEnum("direction").notNull(),
    targetPrice: decimal("targetPrice", { precision: 18, scale: 4 }).notNull(),
    status: metalAlertStatusEnum("status").default("active").notNull(),
    triggeredPrice: decimal("triggeredPrice", { precision: 18, scale: 4 }),
    triggeredAt: timestamp("triggeredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => ({
    userStatusLookup: index("metal_alerts_user_status_idx").on(
      table.userId,
      table.status
    ),
    monitorLookup: index("metal_alerts_monitor_idx").on(
      table.status,
      table.metal
    ),
  })
);

export const structureAlerts = pgTable(
  "structureAlerts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    exchange: varchar("exchange", { length: 32 }).notNull(),
    interval: alertIntervalEnum("interval").notNull(),
    eventType: structureEventEnum("eventType").notNull(),
    status: structureAlertStatusEnum("status").default("active").notNull(),
    triggeredPrice: decimal("triggeredPrice", { precision: 18, scale: 8 }),
    triggeredEventKey: varchar("triggeredEventKey", { length: 96 }),
    qualityScore: integer("qualityScore"),
    triggeredAt: timestamp("triggeredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => ({
    userStatusLookup: index("structure_alerts_user_status_idx").on(
      table.userId,
      table.status
    ),
    monitorLookup: index("structure_alerts_monitor_idx").on(
      table.status,
      table.exchange,
      table.symbol,
      table.interval
    ),
  })
);

export const structureContextAlerts = pgTable(
  "structureContextAlerts",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    symbol: varchar("symbol", { length: 32 }).notNull(),
    exchange: varchar("exchange", { length: 32 }).notNull(),
    interval: alertIntervalEnum("interval").notNull(),
    sourceKind: contextSourceKindEnum("sourceKind").notNull(),
    sourceLabel: varchar("sourceLabel", { length: 160 }).notNull(),
    referencePrice: decimal("referencePrice", {
      precision: 18,
      scale: 8,
    }).notNull(),
    rangeLow: decimal("rangeLow", { precision: 18, scale: 8 }),
    rangeHigh: decimal("rangeHigh", { precision: 18, scale: 8 }),
    invalidationPrice: decimal("invalidationPrice", {
      precision: 18,
      scale: 8,
    }),
    eventType: contextEventTypeEnum("eventType").notNull(),
    proximityBps: integer("proximityBps").notNull().default(15),
    status: contextAlertStatusEnum("status").notNull().default("active"),
    triggeredPrice: decimal("triggeredPrice", { precision: 18, scale: 8 }),
    triggeredAt: timestamp("triggeredAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  table => ({
    userStatusLookup: index("structure_context_alerts_user_status_idx").on(
      table.userId,
      table.status
    ),
    monitorLookup: index("structure_context_alerts_monitor_idx").on(
      table.status,
      table.symbol,
      table.exchange
    ),
  })
);

export const userNotifications = pgTable(
  "userNotifications",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    category: notificationCategoryEnum("category").notNull(),
    title: varchar("title", { length: 180 }).notNull(),
    content: text("content").notNull(),
    metadata: jsonb("metadata").notNull(),
    readAt: timestamp("readAt"),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
  },
  table => ({
    userReadLookup: index("user_notifications_user_read_idx").on(
      table.userId,
      table.readAt,
      table.createdAt
    ),
  })
);

export const userTelegramSettings = pgTable("userTelegramSettings", {
  userId: integer("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  chatId: varchar("chatId", { length: 64 }),
  enabled: integer("enabled").default(0).notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const chartPreferences = pgTable("chartPreferences", {
  userId: integer("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  layers: jsonb("layers").$type<Record<string, unknown>>().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const orderFlowPreferences = pgTable("orderFlowPreferences", {
  userId: integer("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  largeTradeMinNotional: integer("largeTradeMinNotional")
    .notNull()
    .default(5000),
  depthLevels: integer("depthLevels").notNull().default(20),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const marketPulsePreferences = pgTable("marketPulsePreferences", {
  userId: integer("userId")
    .primaryKey()
    .references(() => users.id, { onDelete: "cascade" }),
  // بقي اسم العمود كما هو لتوافق القاعدة الحالية، لكن JSON يحفظ عقد تفضيل نبضة السوق الموسع.
  sections: jsonb("sections").$type<unknown>().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const analysisExternalContextPreferences = pgTable(
  "analysisExternalContextPreferences",
  {
    userId: integer("userId")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    references: jsonb("references")
      .$type<Array<{ symbol: string; exchange: string }>>()
      .notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

export const metalAlertMonitorSettings = pgTable("metalAlertMonitorSettings", {
  id: integer("id").primaryKey(),
  scheduleTaskUid: varchar("scheduleTaskUid", { length: 65 }).unique(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt")
    .defaultNow()
    .$onUpdate(() => new Date())
    .notNull(),
});

export const marketSnapshotCleanupMonitorSettings = pgTable(
  "marketSnapshotCleanupMonitorSettings",
  {
    id: integer("id").primaryKey(),
    scheduleTaskUid: varchar("scheduleTaskUid", { length: 65 }).unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

export const economicCalendarSubscriptions = pgTable(
  "economicCalendarSubscriptions",
  {
    userId: integer("userId")
      .primaryKey()
      .references(() => users.id, { onDelete: "cascade" }),
    enabled: integer("enabled").default(0).notNull(),
    dailyDigestEnabled: integer("dailyDigestEnabled").default(0).notNull(),
    highImpactOnly: integer("highImpactOnly").default(1).notNull(),
    countries: jsonb("countries").$type<string[]>().notNull(),
    preAlertMinutes: integer("preAlertMinutes").default(60).notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

export const economicCalendarDeliveryLog = pgTable(
  "economicCalendarDeliveryLog",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    eventId: varchar("eventId", { length: 180 }).notNull(),
    deliveredAt: timestamp("deliveredAt").defaultNow().notNull(),
  },
  table => ({
    uniqueDelivery: uniqueIndex("economic_calendar_delivery_unique").on(
      table.userId,
      table.eventId
    ),
  })
);

export const economicCalendarMonitorSettings = pgTable(
  "economicCalendarMonitorSettings",
  {
    id: integer("id").primaryKey(),
    scheduleTaskUid: varchar("scheduleTaskUid", { length: 65 }).unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

export const dailyMarketDigestMonitorSettings = pgTable(
  "dailyMarketDigestMonitorSettings",
  {
    id: integer("id").primaryKey(),
    scheduleTaskUid: varchar("scheduleTaskUid", { length: 65 }).unique(),
    createdAt: timestamp("createdAt").defaultNow().notNull(),
    updatedAt: timestamp("updatedAt")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  }
);

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;
export type PaperTrade = typeof paperTrades.$inferSelect;
export type InsertPaperTrade = typeof paperTrades.$inferInsert;
export type SavedSignal = typeof savedSignals.$inferSelect;
export type InsertSavedSignal = typeof savedSignals.$inferInsert;
export type AiProviderSetting = typeof aiProviderSettings.$inferSelect;
export type AiModelUsageEvent = typeof aiModelUsageEvents.$inferSelect;
export type AiConversationMessage = typeof aiConversationMessages.$inferSelect;
export type MetalAlert = typeof metalAlerts.$inferSelect;
export type StructureAlert = typeof structureAlerts.$inferSelect;
export type StructureContextAlert = typeof structureContextAlerts.$inferSelect;
export type UserNotification = typeof userNotifications.$inferSelect;
export type ChartPreferences = typeof chartPreferences.$inferSelect;
export type OrderFlowPreferences = typeof orderFlowPreferences.$inferSelect;
export type MarketPulsePreferences = typeof marketPulsePreferences.$inferSelect;
export type AnalysisExternalContextPreferences =
  typeof analysisExternalContextPreferences.$inferSelect;
export type EconomicCalendarSubscription =
  typeof economicCalendarSubscriptions.$inferSelect;

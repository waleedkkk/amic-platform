CREATE TYPE "public"."ai_message_role" AS ENUM('user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."alert_interval" AS ENUM('5m', '15m', '1h', '4h', '1d', '1wk');--> statement-breakpoint
CREATE TYPE "public"."asset_class" AS ENUM('crypto', 'stock', 'forex', 'futures');--> statement-breakpoint
CREATE TYPE "public"."context_alert_status" AS ENUM('active', 'triggered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."context_event_type" AS ENUM('approach', 'touch', 'invalidation');--> statement-breakpoint
CREATE TYPE "public"."context_source_kind" AS ENUM('support', 'resistance', 'demand_zone', 'supply_zone');--> statement-breakpoint
CREATE TYPE "public"."metal_alert_direction" AS ENUM('above', 'below');--> statement-breakpoint
CREATE TYPE "public"."metal_alert_status" AS ENUM('active', 'triggered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."metal_symbol" AS ENUM('XAUUSD', 'XAGUSD');--> statement-breakpoint
CREATE TYPE "public"."notification_category" AS ENUM('metal_alert', 'structure_alert', 'structure_context_alert');--> statement-breakpoint
CREATE TYPE "public"."signal_recommendation" AS ENUM('strong_buy', 'buy', 'neutral', 'sell', 'strong_sell');--> statement-breakpoint
CREATE TYPE "public"."structure_alert_status" AS ENUM('active', 'triggered', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."structure_event_type" AS ENUM('breakout', 'breakdown', 'bullish_reversal', 'bearish_reversal');--> statement-breakpoint
CREATE TYPE "public"."trade_side" AS ENUM('long', 'short');--> statement-breakpoint
CREATE TYPE "public"."trade_status" AS ENUM('open', 'closed');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('user', 'admin');--> statement-breakpoint
CREATE TABLE "aiConversationMessages" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"role" "ai_message_role" NOT NULL,
	"content" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aiMemorySettings" (
	"userId" integer PRIMARY KEY NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aiModelUsageEvents" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(32) NOT NULL,
	"model" varchar(128) NOT NULL,
	"inputTokens" integer,
	"outputTokens" integer,
	"totalTokens" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aiProviderSettings" (
	"id" serial PRIMARY KEY NOT NULL,
	"provider" varchar(32) NOT NULL,
	"encryptedApiKey" text,
	"keyHint" varchar(16),
	"model" varchar(128) NOT NULL,
	"customBaseUrl" varchar(512),
	"maxOutputTokens" integer DEFAULT 900 NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"isActive" integer DEFAULT 0 NOT NULL,
	"updatedByUserId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "analysisExternalContextPreferences" (
	"userId" integer PRIMARY KEY NOT NULL,
	"references" jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chartPreferences" (
	"userId" integer PRIMARY KEY NOT NULL,
	"layers" jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dailyMarketDigestMonitorSettings" (
	"id" integer PRIMARY KEY NOT NULL,
	"scheduleTaskUid" varchar(65),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "dailyMarketDigestMonitorSettings_scheduleTaskUid_unique" UNIQUE("scheduleTaskUid")
);
--> statement-breakpoint
CREATE TABLE "economicCalendarDeliveryLog" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"eventId" varchar(180) NOT NULL,
	"deliveredAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "economicCalendarMonitorSettings" (
	"id" integer PRIMARY KEY NOT NULL,
	"scheduleTaskUid" varchar(65),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "economicCalendarMonitorSettings_scheduleTaskUid_unique" UNIQUE("scheduleTaskUid")
);
--> statement-breakpoint
CREATE TABLE "economicCalendarSubscriptions" (
	"userId" integer PRIMARY KEY NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"dailyDigestEnabled" integer DEFAULT 0 NOT NULL,
	"highImpactOnly" integer DEFAULT 1 NOT NULL,
	"countries" jsonb NOT NULL,
	"preAlertMinutes" integer DEFAULT 60 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketPulsePreferences" (
	"userId" integer PRIMARY KEY NOT NULL,
	"sections" jsonb NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketSnapshotCleanupMonitorSettings" (
	"id" integer PRIMARY KEY NOT NULL,
	"scheduleTaskUid" varchar(65),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "marketSnapshotCleanupMonitorSettings_scheduleTaskUid_unique" UNIQUE("scheduleTaskUid")
);
--> statement-breakpoint
CREATE TABLE "marketSnapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"cacheKey" varchar(160) NOT NULL,
	"market" varchar(32) NOT NULL,
	"exchange" varchar(32) NOT NULL,
	"timeframe" varchar(8) NOT NULL,
	"payload" jsonb NOT NULL,
	"fetchedAt" timestamp DEFAULT now() NOT NULL,
	"expiresAt" timestamp NOT NULL,
	CONSTRAINT "marketSnapshots_cacheKey_unique" UNIQUE("cacheKey")
);
--> statement-breakpoint
CREATE TABLE "metalAlertMonitorSettings" (
	"id" integer PRIMARY KEY NOT NULL,
	"scheduleTaskUid" varchar(65),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "metalAlertMonitorSettings_scheduleTaskUid_unique" UNIQUE("scheduleTaskUid")
);
--> statement-breakpoint
CREATE TABLE "metalAlerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"metal" "metal_symbol" NOT NULL,
	"direction" "metal_alert_direction" NOT NULL,
	"targetPrice" numeric(18, 4) NOT NULL,
	"status" "metal_alert_status" DEFAULT 'active' NOT NULL,
	"triggeredPrice" numeric(18, 4),
	"triggeredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orderFlowPreferences" (
	"userId" integer PRIMARY KEY NOT NULL,
	"largeTradeMinNotional" integer DEFAULT 5000 NOT NULL,
	"depthLevels" integer DEFAULT 20 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paperTradeCritiques" (
	"paperTradeId" integer PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"content" jsonb NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paperTrades" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"signalId" integer,
	"symbol" varchar(64) NOT NULL,
	"exchange" varchar(32) NOT NULL,
	"assetClass" "asset_class" NOT NULL,
	"side" "trade_side" NOT NULL,
	"status" "trade_status" DEFAULT 'open' NOT NULL,
	"quantity" numeric(24, 8) NOT NULL,
	"entryPrice" numeric(24, 8) NOT NULL,
	"exitPrice" numeric(24, 8),
	"stopLoss" numeric(24, 8),
	"takeProfit" numeric(24, 8),
	"referencePriceAtClose" numeric(24, 8),
	"priceDeviationPercent" numeric(10, 4),
	"priceDeviationWarning" integer DEFAULT 0 NOT NULL,
	"realizedPnl" numeric(24, 8),
	"note" text,
	"openedAt" timestamp DEFAULT now() NOT NULL,
	"closedAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "paperTradingLeaderboardProfiles" (
	"userId" integer PRIMARY KEY NOT NULL,
	"enabled" integer DEFAULT 0 NOT NULL,
	"displayName" varchar(40) NOT NULL,
	"anonymized" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "savedSignals" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"symbol" varchar(64) NOT NULL,
	"exchange" varchar(32) NOT NULL,
	"timeframe" varchar(8) NOT NULL,
	"recommendation" "signal_recommendation" NOT NULL,
	"confidence" integer NOT NULL,
	"summary" text NOT NULL,
	"analysisPayload" jsonb NOT NULL,
	"publicShareId" varchar(36),
	"createdAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "savedSignals_publicShareId_unique" UNIQUE("publicShareId")
);
--> statement-breakpoint
CREATE TABLE "structureAlerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"exchange" varchar(32) NOT NULL,
	"interval" "alert_interval" NOT NULL,
	"eventType" "structure_event_type" NOT NULL,
	"status" "structure_alert_status" DEFAULT 'active' NOT NULL,
	"triggeredPrice" numeric(18, 8),
	"triggeredEventKey" varchar(96),
	"qualityScore" integer,
	"triggeredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "structureContextAlerts" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"symbol" varchar(32) NOT NULL,
	"exchange" varchar(32) NOT NULL,
	"interval" "alert_interval" NOT NULL,
	"sourceKind" "context_source_kind" NOT NULL,
	"sourceLabel" varchar(160) NOT NULL,
	"referencePrice" numeric(18, 8) NOT NULL,
	"rangeLow" numeric(18, 8),
	"rangeHigh" numeric(18, 8),
	"invalidationPrice" numeric(18, 8),
	"eventType" "context_event_type" NOT NULL,
	"proximityBps" integer DEFAULT 15 NOT NULL,
	"status" "context_alert_status" DEFAULT 'active' NOT NULL,
	"triggeredPrice" numeric(18, 8),
	"triggeredAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userNotifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"category" "notification_category" NOT NULL,
	"title" varchar(180) NOT NULL,
	"content" text NOT NULL,
	"metadata" jsonb NOT NULL,
	"readAt" timestamp,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userTelegramSettings" (
	"userId" integer PRIMARY KEY NOT NULL,
	"chatId" varchar(64),
	"enabled" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"openId" varchar(64),
	"name" text,
	"email" varchar(320),
	"passwordHash" varchar(255),
	"loginMethod" varchar(64),
	"role" "user_role" DEFAULT 'user' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"lastSignedIn" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_openId_unique" UNIQUE("openId"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "watchlists" (
	"id" serial PRIMARY KEY NOT NULL,
	"userId" integer NOT NULL,
	"symbol" varchar(64) NOT NULL,
	"exchange" varchar(32) NOT NULL,
	"assetClass" "asset_class" NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "aiConversationMessages" ADD CONSTRAINT "aiConversationMessages_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiMemorySettings" ADD CONSTRAINT "aiMemorySettings_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "aiProviderSettings" ADD CONSTRAINT "aiProviderSettings_updatedByUserId_users_id_fk" FOREIGN KEY ("updatedByUserId") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "analysisExternalContextPreferences" ADD CONSTRAINT "analysisExternalContextPreferences_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chartPreferences" ADD CONSTRAINT "chartPreferences_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economicCalendarDeliveryLog" ADD CONSTRAINT "economicCalendarDeliveryLog_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "economicCalendarSubscriptions" ADD CONSTRAINT "economicCalendarSubscriptions_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketPulsePreferences" ADD CONSTRAINT "marketPulsePreferences_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "metalAlerts" ADD CONSTRAINT "metalAlerts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orderFlowPreferences" ADD CONSTRAINT "orderFlowPreferences_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paperTradeCritiques" ADD CONSTRAINT "paperTradeCritiques_paperTradeId_paperTrades_id_fk" FOREIGN KEY ("paperTradeId") REFERENCES "public"."paperTrades"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paperTradeCritiques" ADD CONSTRAINT "paperTradeCritiques_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paperTrades" ADD CONSTRAINT "paperTrades_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paperTrades" ADD CONSTRAINT "paperTrades_signalId_savedSignals_id_fk" FOREIGN KEY ("signalId") REFERENCES "public"."savedSignals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "paperTradingLeaderboardProfiles" ADD CONSTRAINT "paperTradingLeaderboardProfiles_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "savedSignals" ADD CONSTRAINT "savedSignals_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structureAlerts" ADD CONSTRAINT "structureAlerts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "structureContextAlerts" ADD CONSTRAINT "structureContextAlerts_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userNotifications" ADD CONSTRAINT "userNotifications_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userTelegramSettings" ADD CONSTRAINT "userTelegramSettings_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "watchlists" ADD CONSTRAINT "watchlists_userId_users_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_conversation_messages_user_created_idx" ON "aiConversationMessages" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "ai_model_usage_created_idx" ON "aiModelUsageEvents" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "ai_model_usage_provider_model_created_idx" ON "aiModelUsageEvents" USING btree ("provider","model","createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "ai_provider_settings_provider_uq" ON "aiProviderSettings" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "ai_provider_settings_active_idx" ON "aiProviderSettings" USING btree ("isActive","enabled");--> statement-breakpoint
CREATE UNIQUE INDEX "economic_calendar_delivery_unique" ON "economicCalendarDeliveryLog" USING btree ("userId","eventId");--> statement-breakpoint
CREATE INDEX "market_snapshots_expiry_idx" ON "marketSnapshots" USING btree ("expiresAt");--> statement-breakpoint
CREATE INDEX "metal_alerts_user_status_idx" ON "metalAlerts" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "metal_alerts_monitor_idx" ON "metalAlerts" USING btree ("status","metal");--> statement-breakpoint
CREATE INDEX "paper_trade_critiques_user_idx" ON "paperTradeCritiques" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "paper_trades_user_status_idx" ON "paperTrades" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "paper_trades_user_created_idx" ON "paperTrades" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "paper_trades_signal_idx" ON "paperTrades" USING btree ("signalId");--> statement-breakpoint
CREATE INDEX "saved_signals_user_created_idx" ON "savedSignals" USING btree ("userId","createdAt");--> statement-breakpoint
CREATE INDEX "structure_alerts_user_status_idx" ON "structureAlerts" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "structure_alerts_monitor_idx" ON "structureAlerts" USING btree ("status","exchange","symbol","interval");--> statement-breakpoint
CREATE INDEX "structure_context_alerts_user_status_idx" ON "structureContextAlerts" USING btree ("userId","status");--> statement-breakpoint
CREATE INDEX "structure_context_alerts_monitor_idx" ON "structureContextAlerts" USING btree ("status","symbol","exchange");--> statement-breakpoint
CREATE INDEX "user_notifications_user_read_idx" ON "userNotifications" USING btree ("userId","readAt","createdAt");--> statement-breakpoint
CREATE INDEX "watchlists_user_idx" ON "watchlists" USING btree ("userId");--> statement-breakpoint
CREATE UNIQUE INDEX "watchlists_user_symbol_exchange_uq" ON "watchlists" USING btree ("userId","symbol","exchange");
--> Enable Row Level Security on all application tables; no public policies are created.
ALTER TABLE public."aiConversationMessages" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."aiMemorySettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."aiModelUsageEvents" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."aiProviderSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."analysisExternalContextPreferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."chartPreferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."dailyMarketDigestMonitorSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."economicCalendarDeliveryLog" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."economicCalendarMonitorSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."economicCalendarSubscriptions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketPulsePreferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketSnapshotCleanupMonitorSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."marketSnapshots" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."metalAlertMonitorSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."metalAlerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."orderFlowPreferences" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."paperTradeCritiques" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."paperTrades" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."paperTradingLeaderboardProfiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."savedSignals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."structureAlerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."structureContextAlerts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."userNotifications" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."userTelegramSettings" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."watchlists" ENABLE ROW LEVEL SECURITY;

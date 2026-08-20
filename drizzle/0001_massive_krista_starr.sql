CREATE TABLE `marketSnapshots` (
	`id` int AUTO_INCREMENT NOT NULL,
	`cacheKey` varchar(160) NOT NULL,
	`market` varchar(32) NOT NULL,
	`exchange` varchar(32) NOT NULL,
	`timeframe` varchar(8) NOT NULL,
	`payload` json NOT NULL,
	`fetchedAt` timestamp NOT NULL DEFAULT (now()),
	`expiresAt` timestamp NOT NULL,
	CONSTRAINT `marketSnapshots_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketSnapshots_cacheKey_unique` UNIQUE(`cacheKey`)
);
--> statement-breakpoint
CREATE TABLE `paperTrades` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(64) NOT NULL,
	`exchange` varchar(32) NOT NULL,
	`assetClass` enum('crypto','stock','forex','futures') NOT NULL,
	`side` enum('long','short') NOT NULL,
	`status` enum('open','closed') NOT NULL DEFAULT 'open',
	`quantity` decimal(24,8) NOT NULL,
	`entryPrice` decimal(24,8) NOT NULL,
	`exitPrice` decimal(24,8),
	`stopLoss` decimal(24,8),
	`takeProfit` decimal(24,8),
	`realizedPnl` decimal(24,8),
	`note` text,
	`openedAt` timestamp NOT NULL DEFAULT (now()),
	`closedAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paperTrades_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `savedSignals` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(64) NOT NULL,
	`exchange` varchar(32) NOT NULL,
	`timeframe` varchar(8) NOT NULL,
	`recommendation` enum('strong_buy','buy','neutral','sell','strong_sell') NOT NULL,
	`confidence` int NOT NULL,
	`summary` text NOT NULL,
	`analysisPayload` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `savedSignals_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `watchlists` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(64) NOT NULL,
	`exchange` varchar(32) NOT NULL,
	`assetClass` enum('crypto','stock','forex','futures') NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `watchlists_id` PRIMARY KEY(`id`),
	CONSTRAINT `watchlists_user_symbol_exchange_uq` UNIQUE(`userId`,`symbol`,`exchange`)
);
--> statement-breakpoint
CREATE INDEX `market_snapshots_expiry_idx` ON `marketSnapshots` (`expiresAt`);--> statement-breakpoint
CREATE INDEX `paper_trades_user_status_idx` ON `paperTrades` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `paper_trades_user_created_idx` ON `paperTrades` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `saved_signals_user_created_idx` ON `savedSignals` (`userId`,`createdAt`);--> statement-breakpoint
CREATE INDEX `watchlists_user_idx` ON `watchlists` (`userId`);
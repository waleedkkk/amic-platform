CREATE TABLE `paperTradeCritiques` (
	`paperTradeId` int NOT NULL,
	`userId` int NOT NULL,
	`content` json NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paperTradeCritiques_paperTradeId` PRIMARY KEY(`paperTradeId`)
);
--> statement-breakpoint
ALTER TABLE `paperTradeCritiques` ADD CONSTRAINT `paperTradeCritiques_paperTradeId_paperTrades_id_fk` FOREIGN KEY (`paperTradeId`) REFERENCES `paperTrades`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `paperTradeCritiques` ADD CONSTRAINT `paperTradeCritiques_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `paper_trade_critiques_user_idx` ON `paperTradeCritiques` (`userId`);
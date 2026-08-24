CREATE TABLE `orderFlowPreferences` (
	`userId` int NOT NULL,
	`largeTradeMinNotional` int NOT NULL DEFAULT 5000,
	`depthLevels` int NOT NULL DEFAULT 20,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orderFlowPreferences_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `orderFlowPreferences` ADD CONSTRAINT `orderFlowPreferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
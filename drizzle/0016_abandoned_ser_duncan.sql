CREATE TABLE `paperTradingLeaderboardProfiles` (
	`userId` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`displayName` varchar(40) NOT NULL,
	`anonymized` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `paperTradingLeaderboardProfiles_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `paperTradingLeaderboardProfiles` ADD CONSTRAINT `paperTradingLeaderboardProfiles_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE TABLE `structureAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`exchange` varchar(32) NOT NULL,
	`interval` enum('5m','15m','1h','4h','1d','1wk') NOT NULL,
	`eventType` enum('breakout','breakdown','bullish_reversal','bearish_reversal') NOT NULL,
	`status` enum('active','triggered','cancelled') NOT NULL DEFAULT 'active',
	`triggeredPrice` decimal(18,8),
	`triggeredEventKey` varchar(96),
	`qualityScore` int,
	`triggeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `structureAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `userNotifications` MODIFY COLUMN `category` enum('metal_alert','structure_alert') NOT NULL;--> statement-breakpoint
ALTER TABLE `structureAlerts` ADD CONSTRAINT `structureAlerts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `structure_alerts_user_status_idx` ON `structureAlerts` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `structure_alerts_monitor_idx` ON `structureAlerts` (`status`,`exchange`,`symbol`,`interval`);
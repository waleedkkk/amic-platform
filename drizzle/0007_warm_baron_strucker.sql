CREATE TABLE `metalAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`metal` enum('XAUUSD','XAGUSD') NOT NULL,
	`direction` enum('above','below') NOT NULL,
	`targetPrice` decimal(18,4) NOT NULL,
	`status` enum('active','triggered','cancelled') NOT NULL DEFAULT 'active',
	`triggeredPrice` decimal(18,4),
	`triggeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metalAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userNotifications` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`category` enum('metal_alert') NOT NULL,
	`title` varchar(180) NOT NULL,
	`content` text NOT NULL,
	`metadata` json NOT NULL,
	`readAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `userNotifications_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `userTelegramSettings` (
	`userId` int NOT NULL,
	`chatId` varchar(64),
	`enabled` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `userTelegramSettings_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `metalAlerts` ADD CONSTRAINT `metalAlerts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userNotifications` ADD CONSTRAINT `userNotifications_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `userTelegramSettings` ADD CONSTRAINT `userTelegramSettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `metal_alerts_user_status_idx` ON `metalAlerts` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `metal_alerts_monitor_idx` ON `metalAlerts` (`status`,`metal`);--> statement-breakpoint
CREATE INDEX `user_notifications_user_read_idx` ON `userNotifications` (`userId`,`readAt`,`createdAt`);
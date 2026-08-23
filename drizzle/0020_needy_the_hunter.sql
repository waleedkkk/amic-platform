CREATE TABLE `structureContextAlerts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`symbol` varchar(32) NOT NULL,
	`exchange` varchar(32) NOT NULL,
	`interval` enum('5m','15m','1h','4h','1d','1wk') NOT NULL,
	`sourceKind` enum('support','resistance','demand_zone','supply_zone') NOT NULL,
	`sourceLabel` varchar(160) NOT NULL,
	`referencePrice` decimal(18,8) NOT NULL,
	`rangeLow` decimal(18,8),
	`rangeHigh` decimal(18,8),
	`invalidationPrice` decimal(18,8),
	`eventType` enum('approach','touch','invalidation') NOT NULL,
	`proximityBps` int NOT NULL DEFAULT 15,
	`status` enum('active','triggered','cancelled') NOT NULL DEFAULT 'active',
	`triggeredPrice` decimal(18,8),
	`triggeredAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `structureContextAlerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `userNotifications` MODIFY COLUMN `category` enum('metal_alert','structure_alert','structure_context_alert') NOT NULL;--> statement-breakpoint
ALTER TABLE `structureContextAlerts` ADD CONSTRAINT `structureContextAlerts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `structure_context_alerts_user_status_idx` ON `structureContextAlerts` (`userId`,`status`);--> statement-breakpoint
CREATE INDEX `structure_context_alerts_monitor_idx` ON `structureContextAlerts` (`status`,`symbol`,`exchange`);
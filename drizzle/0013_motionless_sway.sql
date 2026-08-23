CREATE TABLE `economicCalendarDeliveryLog` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`eventId` varchar(180) NOT NULL,
	`deliveredAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `economicCalendarDeliveryLog_id` PRIMARY KEY(`id`),
	CONSTRAINT `economic_calendar_delivery_unique` UNIQUE(`userId`,`eventId`)
);
--> statement-breakpoint
CREATE TABLE `economicCalendarMonitorSettings` (
	`id` int NOT NULL,
	`scheduleTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `economicCalendarMonitorSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `economicCalendarMonitorSettings_scheduleTaskUid_unique` UNIQUE(`scheduleTaskUid`)
);
--> statement-breakpoint
CREATE TABLE `economicCalendarSubscriptions` (
	`userId` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`highImpactOnly` int NOT NULL DEFAULT 1,
	`countries` json NOT NULL,
	`preAlertMinutes` int NOT NULL DEFAULT 60,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `economicCalendarSubscriptions_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `economicCalendarDeliveryLog` ADD CONSTRAINT `economicCalendarDeliveryLog_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `economicCalendarSubscriptions` ADD CONSTRAINT `economicCalendarSubscriptions_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
CREATE TABLE `dailyMarketDigestMonitorSettings` (
	`id` int NOT NULL,
	`scheduleTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `dailyMarketDigestMonitorSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `dailyMarketDigestMonitorSettings_scheduleTaskUid_unique` UNIQUE(`scheduleTaskUid`)
);
--> statement-breakpoint
ALTER TABLE `economicCalendarSubscriptions` ADD `dailyDigestEnabled` int DEFAULT 0 NOT NULL;
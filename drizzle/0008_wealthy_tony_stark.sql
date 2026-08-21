CREATE TABLE `metalAlertMonitorSettings` (
	`id` int NOT NULL,
	`scheduleTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `metalAlertMonitorSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `metalAlertMonitorSettings_scheduleTaskUid_unique` UNIQUE(`scheduleTaskUid`)
);

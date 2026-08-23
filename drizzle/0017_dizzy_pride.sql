CREATE TABLE `marketSnapshotCleanupMonitorSettings` (
	`id` int NOT NULL,
	`scheduleTaskUid` varchar(65),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `marketSnapshotCleanupMonitorSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `marketSnapshotCleanupMonitorSettings_scheduleTaskUid_unique` UNIQUE(`scheduleTaskUid`)
);

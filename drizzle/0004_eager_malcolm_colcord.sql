CREATE TABLE `aiProviderSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(32) NOT NULL,
	`encryptedApiKey` text,
	`keyHint` varchar(16),
	`model` varchar(128) NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`isActive` int NOT NULL DEFAULT 0,
	`updatedByUserId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiProviderSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `ai_provider_settings_provider_uq` UNIQUE(`provider`)
);
--> statement-breakpoint
ALTER TABLE `aiProviderSettings` ADD CONSTRAINT `aiProviderSettings_updatedByUserId_users_id_fk` FOREIGN KEY (`updatedByUserId`) REFERENCES `users`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_provider_settings_active_idx` ON `aiProviderSettings` (`isActive`,`enabled`);
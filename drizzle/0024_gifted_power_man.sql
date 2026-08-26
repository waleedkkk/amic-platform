CREATE TABLE `aiModelUsageEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`provider` varchar(32) NOT NULL,
	`model` varchar(128) NOT NULL,
	`inputTokens` int,
	`outputTokens` int,
	`totalTokens` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiModelUsageEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE INDEX `ai_model_usage_created_idx` ON `aiModelUsageEvents` (`createdAt`);--> statement-breakpoint
CREATE INDEX `ai_model_usage_provider_model_created_idx` ON `aiModelUsageEvents` (`provider`,`model`,`createdAt`);
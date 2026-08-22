CREATE TABLE `aiConversationMessages` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`role` enum('user','assistant') NOT NULL,
	`content` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `aiConversationMessages_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `aiMemorySettings` (
	`userId` int NOT NULL,
	`enabled` int NOT NULL DEFAULT 0,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `aiMemorySettings_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `aiConversationMessages` ADD CONSTRAINT `aiConversationMessages_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `aiMemorySettings` ADD CONSTRAINT `aiMemorySettings_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `ai_conversation_messages_user_created_idx` ON `aiConversationMessages` (`userId`,`createdAt`);
CREATE TABLE `analysisExternalContextPreferences` (
	`userId` int NOT NULL,
	`references` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `analysisExternalContextPreferences_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `analysisExternalContextPreferences` ADD CONSTRAINT `analysisExternalContextPreferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
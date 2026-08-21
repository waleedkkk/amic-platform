CREATE TABLE `chartPreferences` (
	`userId` int NOT NULL,
	`layers` json NOT NULL,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `chartPreferences_userId` PRIMARY KEY(`userId`)
);
--> statement-breakpoint
ALTER TABLE `chartPreferences` ADD CONSTRAINT `chartPreferences_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;
ALTER TABLE `savedSignals` ADD `publicShareId` varchar(36);--> statement-breakpoint
ALTER TABLE `savedSignals` ADD `publicShareId` varchar(36);--> statement-breakpoint
ALTER TABLE `savedSignals` ADD CONSTRAINT `savedSignals_publicShareId_unique` UNIQUE(`publicShareId`);

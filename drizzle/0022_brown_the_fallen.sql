ALTER TABLE `paperTrades` ADD `signalId` int;--> statement-breakpoint
ALTER TABLE `paperTrades` ADD `signalId` int;--> statement-breakpoint
ALTER TABLE `paperTrades` ADD CONSTRAINT `paperTrades_signalId_savedSignals_id_fk` FOREIGN KEY (`signalId`) REFERENCES `savedSignals`(`id`) ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `paper_trades_signal_idx` ON `paperTrades` (`signalId`);

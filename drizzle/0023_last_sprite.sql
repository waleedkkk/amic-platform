ALTER TABLE `paperTrades` ADD `referencePriceAtClose` decimal(24,8);--> statement-breakpoint
ALTER TABLE `paperTrades` ADD `priceDeviationPercent` decimal(10,4);--> statement-breakpoint
ALTER TABLE `paperTrades` ADD `priceDeviationWarning` int DEFAULT 0 NOT NULL;
CREATE TABLE `catalog_brochures` (
	`id` varchar(80) NOT NULL,
	`storeId` varchar(32) NOT NULL,
	`title` text NOT NULL,
	`url` text NOT NULL,
	`period` enum('this-week','next-week','ended') NOT NULL,
	`rawDate` text NOT NULL,
	`thumbnailUrl` text,
	`pageUrls` text NOT NULL,
	CONSTRAINT `catalog_brochures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `catalog_offers` (
	`id` varchar(180) NOT NULL,
	`runId` varchar(64) NOT NULL,
	`product` text NOT NULL,
	`searchText` text NOT NULL,
	`storeId` varchar(32) NOT NULL,
	`storeName` text NOT NULL,
	`price` double,
	`currency` varchar(3),
	`priceLabel` text NOT NULL,
	`unit` varchar(32) NOT NULL,
	`period` enum('this-week','next-week','ended') NOT NULL,
	`validLabel` text NOT NULL,
	`brochureUrl` text NOT NULL,
	`pageUrl` text NOT NULL,
	`source` text NOT NULL,
	`imageUrl` text,
	CONSTRAINT `catalog_offers_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `catalog_stores` (
	`id` varchar(32) NOT NULL,
	`displayOrder` int NOT NULL,
	`name` text NOT NULL,
	`url` text NOT NULL,
	`logo` text NOT NULL,
	`active` int NOT NULL DEFAULT 1,
	CONSTRAINT `catalog_stores_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `catalog_sync` (
	`id` int NOT NULL,
	`activeRunId` varchar(64),
	`status` enum('idle','running','success','error') NOT NULL,
	`stage` text NOT NULL,
	`startedAt` timestamp,
	`finishedAt` timestamp,
	`storesProcessed` int NOT NULL DEFAULT 0,
	`brochuresProcessed` int NOT NULL DEFAULT 0,
	`offersProcessed` int NOT NULL DEFAULT 0,
	`message` text NOT NULL,
	CONSTRAINT `catalog_sync_id` PRIMARY KEY(`id`)
);

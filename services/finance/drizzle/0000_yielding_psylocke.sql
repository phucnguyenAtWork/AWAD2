CREATE TABLE `accounts` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	`type` enum('CASH','BANK','WALLET','CREDIT') NOT NULL DEFAULT 'CASH',
	`currency` varchar(8) NOT NULL DEFAULT 'VND',
	`friction_level` enum('HIGH','MEDIUM','LOW') NOT NULL DEFAULT 'LOW',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `accounts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `budgets` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`account_id` varchar(36) NOT NULL,
	`amount_limit` decimal(14,2) NOT NULL,
	`period` enum('MONTHLY','WEEKLY') NOT NULL DEFAULT 'MONTHLY',
	`alert_threshold` decimal(3,2) NOT NULL DEFAULT '0.80',
	`start_date` date NOT NULL,
	`end_date` date NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `budgets_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`account_id` varchar(36),
	`name` varchar(128) NOT NULL,
	`icon` varchar(50),
	`type` enum('EXPENSE','INCOME') NOT NULL DEFAULT 'EXPENSE',
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `categories_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(36) NOT NULL,
	`type` enum('EXPENSE','INCOME') NOT NULL,
	`amount` decimal(14,2) NOT NULL,
	`currency` varchar(8) NOT NULL DEFAULT 'VND',
	`description` varchar(512),
	`category_id` varchar(36),
	`essential` boolean NOT NULL DEFAULT false,
	`tags` json,
	`occurred_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `transactions_id` PRIMARY KEY(`id`)
);

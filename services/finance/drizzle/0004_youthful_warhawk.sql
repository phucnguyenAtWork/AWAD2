CREATE TABLE `budget_preferences` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(36) NOT NULL,
	`needs_pct` int NOT NULL DEFAULT 50,
	`wants_pct` int NOT NULL DEFAULT 30,
	`savings_pct` int NOT NULL DEFAULT 20,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `budget_preferences_id` PRIMARY KEY(`id`),
	CONSTRAINT `budget_preferences_user_id_unique` UNIQUE(`user_id`)
);

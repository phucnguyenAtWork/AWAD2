CREATE TABLE `category_budgets` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`user_id` varchar(36) NOT NULL,
	`category_id` varchar(36) NOT NULL,
	`monthly_limit` decimal(15,2) NOT NULL,
	`created_at` timestamp DEFAULT (now()),
	`updated_at` timestamp DEFAULT (now()),
	CONSTRAINT `category_budgets_id` PRIMARY KEY(`id`),
	CONSTRAINT `user_category_idx` UNIQUE(`user_id`,`category_id`)
);

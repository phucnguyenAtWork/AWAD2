CREATE TABLE `auth_users` (
	`id` varchar(36) NOT NULL DEFAULT (uuid()),
	`phone` varchar(32) NOT NULL,
	`email` varchar(255),
	`password_hash` varchar(60) NOT NULL,
	`full_name` varchar(255),
	`created_at` timestamp DEFAULT (now()),
	CONSTRAINT `auth_users_id` PRIMARY KEY(`id`),
	CONSTRAINT `auth_users_phone_unique` UNIQUE(`phone`),
	CONSTRAINT `auth_users_email_unique` UNIQUE(`email`)
);

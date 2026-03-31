CREATE TABLE `chat_logs` (
	`id` bigint AUTO_INCREMENT NOT NULL,
	`account_id` char(36) NOT NULL,
	`user_query` text,
	`ai_response` text,
	`context_snapshot` json,
	`action` json,
	`model_name` varchar(64),
	`latency_ms` int,
	`prompt_tokens` int,
	`response_tokens` int,
	`request_id` varchar(36),
	`timestamp` timestamp DEFAULT (now()),
	CONSTRAINT `chat_logs_id` PRIMARY KEY(`id`)
);

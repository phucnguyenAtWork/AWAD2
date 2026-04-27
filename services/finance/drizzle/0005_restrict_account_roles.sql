UPDATE `accounts`
SET `role` = 'Worker'
WHERE `role` IN ('Parent', 'Retiree');
--> statement-breakpoint
ALTER TABLE `accounts`
MODIFY COLUMN `role` enum('Student','Worker','Freelancer') NOT NULL DEFAULT 'Student';

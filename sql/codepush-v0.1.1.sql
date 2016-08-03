ALTER TABLE `users` ADD `ack_code` VARCHAR(10)  NOT NULL  DEFAULT ''  AFTER `identical`;
ALTER TABLE `user_tokens` ADD `name` VARCHAR(50)  NOT NULL  DEFAULT ''  AFTER `uid`;
ALTER TABLE `user_tokens` ADD `is_session` TINYINT(3)  UNSIGNED  NOT NULL  DEFAULT '0' AFTER `description`;
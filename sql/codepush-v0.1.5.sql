ALTER TABLE `packages` ADD `deployments_versions_id` INT  UNSIGNED  NOT NULL  DEFAULT '0'  AFTER `id`;
ALTER TABLE `packages` ADD INDEX `idx_versions_id` (`deployments_versions_id`);

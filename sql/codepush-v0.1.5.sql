ALTER TABLE `packages` ADD `deployment_version_id` INT  UNSIGNED  NOT NULL  DEFAULT '0'  AFTER `id`;
ALTER TABLE `packages` ADD INDEX `idx_versions_id` (`deployment_version_id`);

DROP TABLE IF EXISTS `deployments_history`;
CREATE TABLE `deployments_history` (
  `id` int(11) unsigned NOT NULL AUTO_INCREMENT,
  `deployment_id` int(11) unsigned NOT NULL DEFAULT '0',
  `package_id` int(10) unsigned NOT NULL DEFAULT '0',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_deployment_id` (`deployment_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8;
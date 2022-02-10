import _ from 'lodash';
import { logger } from 'kv-logger';
import { Op } from 'sequelize';

import { Deployments } from '../../models/deployments';
import { DeploymentsVersions } from '../../models/deployments_versions';
import { Packages } from '../../models/packages';
import { PackagesDiff } from '../../models/packages_diff';
import { PackagesMetrics } from '../../models/packages_metrics';
import { LogReportDeploy } from '../../models/log_report_deploy';
import { LogReportDownload } from '../../models/log_report_download';
import { config } from '../config';
import { AppError } from '../app-error';
import { redisClient } from '../utils/connections';

import { DEPLOYMENT_FAILED, DEPLOYMENT_SUCCEEDED } from '../const';

var common = require('../utils/common');

const UPDATE_CHECK = 'UPDATE_CHECK';
const CHOSEN_MAN = 'CHOSEN_MAN';
const EXPIRED = 600;

class ClientManager {
    getUpdateCheckCacheKey(deploymentKey, appVersion, label, packageHash) {
        return [UPDATE_CHECK, deploymentKey, appVersion, label, packageHash].join(':');
    }

    clearUpdateCheckCache(deploymentKey, appVersion, label, packageHash) {
        logger.debug('clear cache Deployments key:', {
            key: deploymentKey,
        });
        let redisCacheKey = this.getUpdateCheckCacheKey(
            deploymentKey,
            appVersion,
            label,
            packageHash,
        );
        return redisClient.keys(redisCacheKey).then((data) => {
            if (_.isArray(data)) {
                return Promise.all(
                    data.map((key) => {
                        return redisClient.del(key);
                    }),
                );
            }
            return null;
        });
    }

    updateCheckFromCache(deploymentKey, appVersion, label, packageHash, clientUniqueId) {
        const self = this;
        var updateCheckCache = _.get(config, 'common.updateCheckCache', false);
        if (updateCheckCache === false) {
            return self.updateCheck(deploymentKey, appVersion, label, packageHash, clientUniqueId);
        }
        let redisCacheKey = self.getUpdateCheckCacheKey(
            deploymentKey,
            appVersion,
            label,
            packageHash,
        );
        return redisClient.get(redisCacheKey).then((data) => {
            if (data) {
                try {
                    logger.debug('updateCheckFromCache read from catch');
                    var obj = JSON.parse(data);
                    return obj;
                } catch (e) {}
            }
            return self
                .updateCheck(deploymentKey, appVersion, label, packageHash, clientUniqueId)
                .then((rs) => {
                    try {
                        logger.debug('updateCheckFromCache read from db');
                        var strRs = JSON.stringify(rs);
                        redisClient.setEx(redisCacheKey, EXPIRED, strRs);
                    } catch (e) {}
                    return rs;
                });
        });
    }

    getChosenManCacheKey(packageId, rollout, clientUniqueId) {
        return [CHOSEN_MAN, packageId, rollout, clientUniqueId].join(':');
    }

    random(rollout) {
        var r = Math.ceil(Math.random() * 10000);
        if (r < rollout * 100) {
            return Promise.resolve(true);
        } else {
            return Promise.resolve(false);
        }
    }

    chosenMan(packageId, rollout, clientUniqueId: string) {
        var self = this;
        if (rollout >= 100) {
            return Promise.resolve(true);
        }
        var rolloutClientUniqueIdCache = _.get(config, 'common.rolloutClientUniqueIdCache', false);
        if (rolloutClientUniqueIdCache === false) {
            return self.random(rollout);
        } else {
            var redisCacheKey = self.getChosenManCacheKey(packageId, rollout, clientUniqueId);
            return redisClient.get(redisCacheKey).then((data) => {
                if (data == '1') {
                    return true;
                } else if (data == '2') {
                    return false;
                } else {
                    return self.random(rollout).then((r) => {
                        return redisClient
                            .setEx(redisCacheKey, 60 * 60 * 24 * 7, r ? '1' : '2')
                            .then(() => {
                                return r;
                            });
                    });
                }
            });
        }
    }

    updateCheck(deploymentKey: string, appVersion, label, packageHash, clientUniqueId: string) {
        var rs = {
            packageId: 0,
            downloadURL: '',
            downloadUrl: '',
            description: '',
            isAvailable: false,
            isDisabled: true,
            isMandatory: false,
            appVersion: appVersion,
            targetBinaryRange: '',
            packageHash: '',
            label: '',
            packageSize: 0,
            updateAppVersion: false,
            shouldRunBinaryVersion: false,
            rollout: 100,
        };
        var self = this;
        if (_.isEmpty(deploymentKey) || _.isEmpty(appVersion)) {
            return Promise.reject(new AppError('please input deploymentKey and appVersion'));
        }
        return Deployments.findOne({ where: { deployment_key: deploymentKey } })
            .then((dep) => {
                if (_.isEmpty(dep)) {
                    throw new AppError('Not found deployment, check deployment key is right.');
                }
                var version = common.parseVersion(appVersion);
                return DeploymentsVersions.findAll({
                    where: {
                        deployment_id: dep.id,
                        min_version: { [Op.lte]: version },
                        max_version: { [Op.gt]: version },
                    },
                }).then((deploymentsVersionsMore) => {
                    var distance = 0;
                    var item = null;
                    _.map(deploymentsVersionsMore, function (value, index) {
                        if (index == 0) {
                            item = value;
                            distance = value.max_version - value.min_version;
                        } else {
                            if (distance > value.max_version - value.min_version) {
                                distance = value.max_version - value.min_version;
                                item = value;
                            }
                        }
                    });
                    logger.debug({
                        item,
                    });
                    return item;
                });
            })
            .then((deploymentsVersions) => {
                var packageId = _.get(deploymentsVersions, 'current_package_id', 0);
                if (_.eq(packageId, 0)) {
                    return;
                }
                return Packages.findByPk(packageId)
                    .then((packages) => {
                        if (
                            packages &&
                            _.eq(packages.deployment_id, deploymentsVersions.deployment_id) &&
                            !_.eq(packages.package_hash, packageHash)
                        ) {
                            rs.packageId = packageId;
                            rs.targetBinaryRange = deploymentsVersions.app_version;
                            rs.downloadUrl = rs.downloadURL = common.getBlobDownloadUrl(
                                _.get(packages, 'blob_url'),
                            );
                            rs.description = _.get(packages, 'description', '');
                            rs.isAvailable = _.eq(packages.is_disabled, 1) ? false : true;
                            rs.isDisabled = _.eq(packages.is_disabled, 1) ? true : false;
                            rs.isMandatory = _.eq(packages.is_mandatory, 1) ? true : false;
                            rs.appVersion = appVersion;
                            rs.packageHash = _.get(packages, 'package_hash', '');
                            rs.label = _.get(packages, 'label', '');
                            rs.packageSize = _.get(packages, 'size', 0);
                            rs.rollout = _.get(packages, 'rollout', 100);
                        }
                        return packages;
                    })
                    .then((packages) => {
                        // 尝试增量更新
                        if (
                            packageHash &&
                            !_.isEmpty(packages) &&
                            !_.eq(_.get(packages, 'package_hash', ''), packageHash)
                        ) {
                            return PackagesDiff.findOne({
                                where: {
                                    package_id: packages.id,
                                    diff_against_package_hash: packageHash,
                                },
                            }).then((diffPackage) => {
                                if (!_.isEmpty(diffPackage)) {
                                    rs.downloadURL = common.getBlobDownloadUrl(
                                        _.get(diffPackage, 'diff_blob_url'),
                                    );
                                    rs.downloadUrl = common.getBlobDownloadUrl(
                                        _.get(diffPackage, 'diff_blob_url'),
                                    );
                                    rs.packageSize = _.get(diffPackage, 'diff_size', 0);
                                }
                                return;
                            });
                        } else {
                            return;
                        }
                    });
            })
            .then(() => {
                return rs;
            });
    }

    getPackagesInfo(deploymentKey, label) {
        if (_.isEmpty(deploymentKey) || _.isEmpty(label)) {
            return Promise.reject(new AppError('please input deploymentKey and label'));
        }
        return Deployments.findOne({ where: { deployment_key: deploymentKey } })
            .then((dep) => {
                if (_.isEmpty(dep)) {
                    throw new AppError('does not found deployment');
                }
                return Packages.findOne({ where: { deployment_id: dep.id, label: label } });
            })
            .then((packages) => {
                if (_.isEmpty(packages)) {
                    throw new AppError('does not found packages');
                }
                return packages;
            });
    }

    reportStatusDownload(deploymentKey, label, clientUniqueId) {
        return this.getPackagesInfo(deploymentKey, label).then((packages) => {
            return Promise.all([
                PackagesMetrics.findOne({ where: { package_id: packages.id } }).then((metrics) => {
                    if (metrics) {
                        return metrics.increment('downloaded');
                    }
                    return;
                }),
                LogReportDownload.create({
                    package_id: packages.id,
                    client_unique_id: clientUniqueId,
                }),
            ]);
        });
    }

    reportStatusDeploy(deploymentKey: string, label, clientUniqueId: string, others) {
        return this.getPackagesInfo(deploymentKey, label).then((packages) => {
            var statusText = _.get(others, 'status');
            var status = 0;
            if (_.eq(statusText, 'DeploymentSucceeded')) {
                status = DEPLOYMENT_SUCCEEDED;
            } else if (_.eq(statusText, 'DeploymentFailed')) {
                status = DEPLOYMENT_FAILED;
            }
            var packageId = packages.id;
            var previous_deployment_key = _.get(others, 'previousDeploymentKey');
            var previous_label = _.get(others, 'previousLabelOrAppVersion');
            if (status > 0) {
                return Promise.all([
                    LogReportDeploy.create({
                        package_id: packageId,
                        client_unique_id: clientUniqueId,
                        previous_label: previous_label,
                        previous_deployment_key: previous_deployment_key,
                        status: status,
                    }),
                    PackagesMetrics.findOne({ where: { package_id: packageId } }).then(
                        (metrics) => {
                            if (_.isEmpty(metrics)) {
                                return;
                            }
                            if (_.eq(status, DEPLOYMENT_SUCCEEDED)) {
                                return metrics.increment(['installed', 'active'], { by: 1 });
                            } else {
                                return metrics.increment(['installed', 'failed'], { by: 1 });
                            }
                        },
                    ),
                ]).then(() => {
                    if (previous_deployment_key && previous_label) {
                        return Deployments.findOne({
                            where: { deployment_key: previous_deployment_key },
                        })
                            .then((dep) => {
                                if (_.isEmpty(dep)) {
                                    return;
                                }
                                return Packages.findOne({
                                    where: { deployment_id: dep.id, label: previous_label },
                                }).then((p) => {
                                    if (_.isEmpty(p)) {
                                        return;
                                    }
                                    return PackagesMetrics.findOne({
                                        where: { package_id: p.id },
                                    });
                                });
                            })
                            .then((metrics) => {
                                if (metrics) {
                                    return metrics.decrement('active');
                                }
                                return;
                            });
                    }
                    return;
                });
            } else {
                return;
            }
        });
    }
}

export const clientManager = new ClientManager();

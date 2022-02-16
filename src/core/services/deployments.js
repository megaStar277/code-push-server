import _ from 'lodash';
import moment from 'moment';
import { logger } from 'kv-logger';

import { Deployments } from '../../models/deployments';
import { DeploymentsVersions } from '../../models/deployments_versions';
import { DeploymentsHistory } from '../../models/deployments_history';
import { Packages } from '../../models/packages';
import { PackagesDiff } from '../../models/packages_diff';
import { PackagesMetrics } from '../../models/packages_metrics';
import { Users } from '../../models/users';
import { sequelize } from '../utils/connections';
import { AppError } from '../app-error';
import { randToken } from '../../core/utils/security';

var common = require('../../core/utils/common');

var proto = (module.exports = function () {
    function Deployments() {}
    Deployments.__proto__ = proto;
    return Deployments;
});

proto.getAllPackageIdsByDeploymentsId = function (deploymentsId) {
    return Packages.findAll({ where: { deployment_id: deploymentsId } });
};

proto.existDeloymentName = function (appId, name) {
    return Deployments.findOne({
        where: { appid: appId, name: name },
    }).then((data) => {
        if (!_.isEmpty(data)) {
            throw new AppError(name + ' name does Exist!');
        } else {
            return data;
        }
    });
};

proto.addDeloyment = function (name, appId, uid) {
    var self = this;
    return Users.findByPk(uid).then((user) => {
        if (_.isEmpty(user)) {
            throw new AppError("can't find user");
        }
        return self.existDeloymentName(appId, name).then(() => {
            var identical = user.identical;
            var deploymentKey = randToken(28) + identical;
            return Deployments.create({
                appid: appId,
                name: name,
                deployment_key: deploymentKey,
                last_deployment_version_id: 0,
                label_id: 0,
            });
        });
    });
};

proto.renameDeloymentByName = function (deploymentName, appId, newName) {
    return this.existDeloymentName(appId, newName).then(() => {
        return Deployments.update(
            { name: newName },
            { where: { name: deploymentName, appid: appId } },
        ).then(([affectedCount, affectedRow]) => {
            if (_.gt(affectedCount, 0)) {
                return { name: newName };
            } else {
                throw new AppError(`does not find the deployment "${deploymentName}"`);
            }
        });
    });
};

proto.deleteDeloymentByName = function (deploymentName, appId) {
    return Deployments.destroy({
        where: { name: deploymentName, appid: appId },
    }).then((rowNum) => {
        if (_.gt(rowNum, 0)) {
            return { name: `${deploymentName}` };
        } else {
            throw new AppError(`does not find the deployment "${deploymentName}"`);
        }
    });
};

proto.findDeloymentByName = function (deploymentName, appId) {
    logger.debug('findDeloymentByName', {
        name: deploymentName,
        appId,
    });
    return Deployments.findOne({
        where: { name: deploymentName, appid: appId },
    });
};

proto.findPackagesAndOtherInfos = function (packageId) {
    return Packages.findOne({
        where: { id: packageId },
    })
        .then((packageInfo) => {
            if (!packageInfo) {
                return null;
            }
            return Promise.all([
                Promise.resolve(packageInfo),
                PackagesDiff.findAll({
                    where: { package_id: packageId },
                }).then((diffs) => {
                    if (diffs.length > 0) {
                        return _.reduce(
                            diffs,
                            (result, v) => {
                                result[_.get(v, 'diff_against_package_hash')] = {
                                    size: _.get(v, 'diff_size'),
                                    url: common.getBlobDownloadUrl(_.get(v, 'diff_blob_url')),
                                };
                                return result;
                            },
                            {},
                        );
                    }
                    return null;
                }),
                Users.findOne({
                    where: { id: packageInfo.released_by },
                }),
                DeploymentsVersions.findByPk(packageInfo.deployment_version_id),
            ]);
        })
        .then(([packageInfo, packageDiffMap, userInfo, deploymentsVersions]) => {
            return {
                packageInfo,
                packageDiffMap,
                userInfo,
                deploymentsVersions,
            };
        });
};

proto.findDeloymentsPackages = function (deploymentsVersionsId) {
    var self = this;
    return DeploymentsVersions.findOne({
        where: { id: deploymentsVersionsId },
    }).then((deploymentsVersionsInfo) => {
        if (deploymentsVersionsInfo) {
            return self.findPackagesAndOtherInfos(deploymentsVersionsInfo.current_package_id);
        }
        return null;
    });
};

proto.formatPackage = function (packageVersion) {
    if (!packageVersion) {
        return null;
    }
    return {
        description: _.get(packageVersion, 'packageInfo.description'),
        isDisabled: false,
        isMandatory: _.get(packageVersion, 'packageInfo.is_mandatory') == 1 ? true : false,
        rollout: 100,
        appVersion: _.get(packageVersion, 'deploymentsVersions.app_version'),
        packageHash: _.get(packageVersion, 'packageInfo.package_hash'),
        blobUrl: common.getBlobDownloadUrl(_.get(packageVersion, 'packageInfo.blob_url')),
        size: _.get(packageVersion, 'packageInfo.size'),
        manifestBlobUrl: common.getBlobDownloadUrl(
            _.get(packageVersion, 'packageInfo.manifest_blob_url'),
        ),
        diffPackageMap: _.get(packageVersion, 'packageDiffMap'),
        releaseMethod: _.get(packageVersion, 'packageInfo.release_method'),
        uploadTime: parseInt(moment(_.get(packageVersion, 'packageInfo.updated_at')).format('x')),
        originalLabel: _.get(packageVersion, 'packageInfo.original_label'),
        originalDeployment: _.get(packageVersion, 'packageInfo.original_deployment'),
        label: _.get(packageVersion, 'packageInfo.label'),
        releasedBy: _.get(packageVersion, 'userInfo.email'),
    };
};

proto.listDeloyments = function (appId) {
    var self = this;
    return Deployments.findAll({ where: { appid: appId } }).then((deploymentsInfos) => {
        if (_.isEmpty(deploymentsInfos)) {
            return [];
        }
        return Promise.all(
            deploymentsInfos.map((v) => {
                return self.listDeloyment(v);
            }),
        );
    });
};

proto.listDeloyment = function (deploymentInfo) {
    return this.findDeloymentsPackages([deploymentInfo.last_deployment_version_id])
        .then(this.formatPackage)
        .then((packageInfo) => {
            return {
                createdTime: parseInt(moment(deploymentInfo.created_at).format('x')),
                id: `${deploymentInfo.id}`,
                key: deploymentInfo.deployment_key,
                name: deploymentInfo.name,
                package: packageInfo,
            };
        });
};

proto.getDeploymentHistory = function (deploymentId) {
    var self = this;
    return DeploymentsHistory.findAll({
        where: { deployment_id: deploymentId },
        order: [['id', 'desc']],
        limit: 15,
    })
        .then((history) => {
            return _.map(history, (v) => {
                return v.package_id;
            });
        })
        .then((packageIds) => {
            return Promise.all(
                packageIds.map((v) => {
                    return self.findPackagesAndOtherInfos(v).then(self.formatPackage);
                }),
            );
        });
};

proto.deleteDeploymentHistory = function (deploymentId) {
    return sequelize.transaction((t) => {
        return Promise.all([
            Deployments.update(
                { last_deployment_version_id: 0, label_id: 0 },
                { where: { id: deploymentId }, transaction: t },
            ),
            DeploymentsHistory.findAll({
                where: { deployment_id: deploymentId },
                order: [['id', 'desc']],
                limit: 1000,
            }).then((rs) => {
                return Promise.all(
                    rs.map((v) => {
                        return v.destroy({ transaction: t });
                    }),
                );
            }),
            DeploymentsVersions.findAll({
                where: { deployment_id: deploymentId },
                order: [['id', 'desc']],
                limit: 1000,
            }).then((rs) => {
                return Promise.all(
                    rs.map((v) => {
                        return v.destroy({ transaction: t });
                    }),
                );
            }),
            Packages.findAll({
                where: { deployment_id: deploymentId },
                order: [['id', 'desc']],
                limit: 1000,
            }).then((rs) => {
                return Promise.all(
                    rs.map((v) => {
                        return v.destroy({ transaction: t }).then(() => {
                            return Promise.all([
                                PackagesMetrics.destroy({
                                    where: { package_id: v.get('id') },
                                    transaction: t,
                                }),
                                PackagesDiff.destroy({
                                    where: { package_id: v.get('id') },
                                    transaction: t,
                                }),
                            ]);
                        });
                    }),
                );
            }),
        ]);
    });
};

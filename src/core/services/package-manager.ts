import { Op } from 'sequelize';
import _ from 'lodash';
import formidable from 'formidable';
import fs from 'fs';
import slash from 'slash';
import os from 'os';
import path from 'path';
import { logger } from 'kv-logger';
import yazl from 'yazl';

import { Apps } from '../../models/apps';
import { Deployments, generateDeploymentsLabelId } from '../../models/deployments';
import { DeploymentsVersions } from '../../models/deployments_versions';
import { DeploymentsHistory } from '../../models/deployments_history';
import { Packages, PackagesInterface } from '../../models/packages';
import { PackagesDiff } from '../../models/packages_diff';
import { PackagesMetrics } from '../../models/packages_metrics';
import { sequelize } from '../utils/connections';
import { AppError } from '../app-error';
import {
    DIFF_MANIFEST_FILE_NAME,
    IS_DISABLED_NO,
    IS_DISABLED_YES,
    IS_MANDATORY_NO,
    IS_MANDATORY_YES,
    RELEAS_EMETHOD_PROMOTE,
    RELEAS_EMETHOD_UPLOAD,
} from '../const';

var dataCenterManager = require('./datacenter-manager')();
var security = require('../utils/security');
var common = require('../utils/common');

class PackageManager {
    getMetricsbyPackageId = function (packageId) {
        return PackagesMetrics.findOne({ where: { package_id: packageId } });
    };

    findPackageInfoByDeploymentIdAndLabel = function (deploymentId, label) {
        return Packages.findOne({ where: { deployment_id: deploymentId, label: label } });
    };

    findLatestPackageInfoByDeployVersion = function (deploymentsVersionsId) {
        return DeploymentsVersions.findByPk(deploymentsVersionsId).then((deploymentsVersions) => {
            if (!deploymentsVersions || deploymentsVersions.current_package_id < 0) {
                var e = new AppError('not found last packages');
                logger.debug(e);
                throw e;
            }
            return Packages.findByPk(deploymentsVersions.current_package_id);
        });
    };

    parseReqFile(req) {
        logger.debug('parseReqFile');
        return new Promise((resolve, reject) => {
            var form = formidable();
            form.parse(req, (err, fields, files) => {
                if (err) {
                    logger.debug('parseReqFile:', err);
                    reject(new AppError('upload error'));
                } else {
                    logger.debug('parseReqFile fields:', fields);
                    logger.debug('parseReqFile file location:', _.get(files, 'package.filepath'));
                    if (_.isEmpty(fields.packageInfo) || _.isEmpty(_.get(files, 'package'))) {
                        logger.debug('parseReqFile upload info lack');
                        reject(new AppError('upload info lack'));
                    } else {
                        logger.debug('parseReqFile is ok');
                        resolve({
                            packageInfo: JSON.parse(fields.packageInfo),
                            package: files.package,
                        });
                    }
                }
            });
        });
    }

    createDeploymentsVersionIfNotExist(deploymentId, appVersion, minVersion, maxVersion, t) {
        return DeploymentsVersions.findOrCreate({
            where: {
                deployment_id: deploymentId,
                app_version: appVersion,
                min_version: minVersion,
                max_version: maxVersion,
            },
            defaults: { current_package_id: 0 },
            transaction: t,
        }).then(([data, created]) => {
            if (created) {
                logger.debug(
                    `createDeploymentsVersionIfNotExist findOrCreate version ${appVersion}`,
                );
            }
            logger.debug(`createDeploymentsVersionIfNotExist version data:`, data.get());
            return data;
        });
    }

    isMatchPackageHash(packageId, packageHash) {
        if (_.lt(packageId, 0)) {
            logger.debug(`isMatchPackageHash packageId is 0`);
            return Promise.resolve(false);
        }
        return Packages.findByPk(packageId).then((data) => {
            if (data && _.eq(data.get('package_hash'), packageHash)) {
                logger.debug(`isMatchPackageHash data:`, data.get());
                logger.debug(`isMatchPackageHash packageHash exist`);
                return true;
            } else {
                logger.debug(`isMatchPackageHash package is null`);
                return false;
            }
        });
    }

    createPackage(deploymentId, appVersion, packageHash, manifestHash, blobHash, params) {
        var releaseMethod = params.releaseMethod || RELEAS_EMETHOD_UPLOAD;
        var releaseUid = params.releaseUid || 0;
        var isMandatory = params.isMandatory || 0;
        var size = params.size || 0;
        var rollout = params.rollout || 100;
        var description = params.description || '';
        var originalLabel = params.originalLabel || '';
        var isDisabled = params.isDisabled || 0;
        var originalDeployment = params.originalDeployment || '';
        var self = this;
        return generateDeploymentsLabelId(deploymentId).then((labelId) => {
            return sequelize.transaction((t) => {
                return self
                    .createDeploymentsVersionIfNotExist(
                        deploymentId,
                        appVersion,
                        params.min_version,
                        params.max_version,
                        t,
                    )
                    .then((deploymentsVersions) => {
                        return Packages.create(
                            {
                                deployment_version_id: deploymentsVersions.id,
                                deployment_id: deploymentId,
                                description: description,
                                package_hash: packageHash,
                                blob_url: blobHash,
                                size: size,
                                manifest_blob_url: manifestHash,
                                release_method: releaseMethod,
                                label: 'v' + labelId,
                                released_by: releaseUid,
                                is_mandatory: isMandatory,
                                is_disabled: isDisabled,
                                rollout: rollout,
                                original_label: originalLabel,
                                original_deployment: originalDeployment,
                            },
                            { transaction: t },
                        ).then((packages) => {
                            deploymentsVersions.set('current_package_id', packages.id);
                            return Promise.all([
                                deploymentsVersions.save({ transaction: t }),
                                Deployments.update(
                                    { last_deployment_version_id: deploymentsVersions.id },
                                    { where: { id: deploymentId }, transaction: t },
                                ),
                                PackagesMetrics.create(
                                    { package_id: packages.id },
                                    { transaction: t },
                                ),
                                DeploymentsHistory.create(
                                    { deployment_id: deploymentId, package_id: packages.id },
                                    { transaction: t },
                                ),
                            ]).then(() => packages);
                        });
                    });
            });
        });
    }

    downloadPackageAndExtract(workDirectoryPath, packageHash, blobHash) {
        return dataCenterManager.validateStore(packageHash).then((isValidate) => {
            if (isValidate) {
                return dataCenterManager.getPackageInfo(packageHash);
            } else {
                var downloadURL = common.getBlobDownloadUrl(blobHash);
                return common
                    .createFileFromRequest(downloadURL, path.join(workDirectoryPath, blobHash))
                    .then((download) => {
                        return common
                            .unzipFile(
                                path.join(workDirectoryPath, blobHash),
                                path.join(workDirectoryPath, 'current'),
                            )
                            .then((outputPath) => {
                                return dataCenterManager.storePackage(outputPath, true);
                            });
                    });
            }
        });
    }

    zipDiffPackage(fileName, files, baseDirectoryPath, hotCodePushFile) {
        return new Promise<{ isTemporary: boolean; path: string }>((resolve, reject) => {
            var zipFile = new yazl.ZipFile();
            var writeStream = fs.createWriteStream(fileName);
            writeStream.on('error', (error) => {
                reject(error);
            });
            zipFile.outputStream
                .pipe(writeStream)
                .on('error', (error) => {
                    reject(error);
                })
                .on('close', () => {
                    resolve({ isTemporary: true, path: fileName });
                });
            for (var i = 0; i < files.length; ++i) {
                var file = files[i];
                zipFile.addFile(path.join(baseDirectoryPath, file), slash(file));
            }
            zipFile.addFile(hotCodePushFile, DIFF_MANIFEST_FILE_NAME);
            zipFile.end();
        });
    }

    generateOneDiffPackage(
        workDirectoryPath,
        packageId,
        originDataCenter,
        oldPackageDataCenter,
        diffPackageHash,
        diffManifestBlobHash,
    ) {
        var self = this;
        return PackagesDiff.findOne({
            where: {
                package_id: packageId,
                diff_against_package_hash: diffPackageHash,
            },
        }).then((diffPackage) => {
            if (!_.isEmpty(diffPackage)) {
                return;
            }
            logger.debug('generateOneDiffPackage', {
                packageId,
                originDataCenter,
                oldPackageDataCenter,
            });
            var downloadURL = common.getBlobDownloadUrl(diffManifestBlobHash);
            return common
                .createFileFromRequest(
                    downloadURL,
                    path.join(workDirectoryPath, diffManifestBlobHash),
                )
                .then(() => {
                    var dataCenterContentPath = path.join(workDirectoryPath, 'dataCenter');
                    common.copySync(originDataCenter.contentPath, dataCenterContentPath);
                    var oldPackageDataCenterContentPath = oldPackageDataCenter.contentPath;
                    var originManifestJson = JSON.parse(
                        fs.readFileSync(originDataCenter.manifestFilePath, 'utf8'),
                    );
                    var diffManifestJson = JSON.parse(
                        fs.readFileSync(path.join(workDirectoryPath, diffManifestBlobHash), 'utf8'),
                    );
                    var json = common.diffCollectionsSync(originManifestJson, diffManifestJson);
                    var files = _.concat(json.diff, json.collection1Only);
                    var hotcodepush = { deletedFiles: json.collection2Only, patchedFiles: [] };
                    var hotCodePushFile = path.join(
                        workDirectoryPath,
                        `${diffManifestBlobHash}_hotcodepush`,
                    );
                    fs.writeFileSync(hotCodePushFile, JSON.stringify(hotcodepush));
                    var fileName = path.join(workDirectoryPath, `${diffManifestBlobHash}.zip`);
                    return self
                        .zipDiffPackage(fileName, files, dataCenterContentPath, hotCodePushFile)
                        .then((data) => {
                            return security.qetag(data.path).then((diffHash) => {
                                return common.uploadFileToStorage(diffHash, fileName).then(() => {
                                    var stats = fs.statSync(fileName);
                                    return PackagesDiff.create({
                                        package_id: packageId,
                                        diff_against_package_hash: diffPackageHash,
                                        diff_blob_url: diffHash,
                                        diff_size: stats.size,
                                    });
                                });
                            });
                        });
                });
        });
    }

    createDiffPackagesByLastNums(appId, originalPackage, num) {
        var self = this;
        var packageId = originalPackage.id;
        return Promise.all([
            Packages.findAll({
                where: {
                    deployment_version_id: originalPackage.deployment_version_id,
                    id: { [Op.lt]: packageId },
                },
                order: [['id', 'desc']],
                limit: num,
            }),
            Packages.findAll({
                where: {
                    deployment_version_id: originalPackage.deployment_version_id,
                    id: { [Op.lt]: packageId },
                },
                order: [['id', 'asc']],
                limit: 2,
            }),
            Apps.findByPk(appId),
        ])
            .then(([lastNumsPackages, basePackages, appInfo]) => {
                return [
                    _.uniqBy(_.unionBy(lastNumsPackages, basePackages, 'id'), 'package_hash'),
                    appInfo,
                ];
            })
            .then(([lastNumsPackages, appInfo]) => {
                return self.createDiffPackages(originalPackage, lastNumsPackages);
            });
    }

    createDiffPackages(originalPackage, destPackages) {
        if (!_.isArray(destPackages)) {
            return Promise.reject(new AppError('第二个参数必须是数组'));
        }
        if (destPackages.length <= 0) {
            return null;
        }
        var self = this;
        var package_hash = _.get(originalPackage, 'package_hash');
        var manifest_blob_url = _.get(originalPackage, 'manifest_blob_url');
        var blob_url = _.get(originalPackage, 'blob_url');
        var workDirectoryPath = path.join(os.tmpdir(), 'codepush_' + security.randToken(32));
        logger.debug('createDiffPackages using dir', { workDirectoryPath });
        return common
            .createEmptyFolder(workDirectoryPath)
            .then(() => self.downloadPackageAndExtract(workDirectoryPath, package_hash, blob_url))
            .then((originDataCenter) =>
                Promise.all(
                    destPackages.map((v) => {
                        var diffWorkDirectoryPath = path.join(
                            workDirectoryPath,
                            _.get(v, 'package_hash'),
                        );
                        common.createEmptyFolderSync(diffWorkDirectoryPath);
                        return self
                            .downloadPackageAndExtract(
                                diffWorkDirectoryPath,
                                _.get(v, 'package_hash'),
                                _.get(v, 'blob_url'),
                            )
                            .then((oldPackageDataCenter) =>
                                self.generateOneDiffPackage(
                                    diffWorkDirectoryPath,
                                    originalPackage.id,
                                    originDataCenter,
                                    oldPackageDataCenter,
                                    v.package_hash,
                                    v.manifest_blob_url,
                                ),
                            );
                    }),
                ),
            )
            .finally(() => common.deleteFolderSync(workDirectoryPath));
    }

    releasePackage(appId, deploymentId, packageInfo, filePath, releaseUid) {
        var self = this;
        var appVersion = packageInfo.appVersion;
        var versionInfo = common.validatorVersion(appVersion);
        if (!versionInfo[0]) {
            logger.debug(`releasePackage targetBinaryVersion ${appVersion} not support.`);
            return Promise.reject(new AppError(`targetBinaryVersion ${appVersion} not support.`));
        }
        var description = packageInfo.description; //描述
        var isDisabled = packageInfo.isDisabled; //是否立刻下载
        var rollout = packageInfo.rollout; //灰度百分比
        var isMandatory = packageInfo.isMandatory; //是否强制更新，无法跳过
        var tmpDir = os.tmpdir();
        var directoryPathParent = path.join(tmpDir, 'codepuh_' + security.randToken(32));
        var directoryPath = path.join(directoryPathParent, 'current');
        logger.debug(`releasePackage generate an random dir path: ${directoryPath}`);
        return Promise.all([
            security.qetag(filePath),
            common.createEmptyFolder(directoryPath).then(() => {
                return common.unzipFile(filePath, directoryPath);
            }),
        ])
            .then(([blobHash]) => {
                return security.uploadPackageType(directoryPath).then((type) => {
                    return Apps.findByPk(appId).then((appInfo) => {
                        if (type > 0 && appInfo.os > 0 && appInfo.os != type) {
                            var e = new AppError('it must be publish it by ios type');
                            logger.debug(e);
                            throw e;
                        } else {
                            //不验证
                            logger.debug(`Unknown package type:`, {
                                type,
                                os: appInfo.os,
                            });
                        }
                        return blobHash;
                    });
                });
            })
            .then((blobHash) => {
                var dataCenterManager = require('./datacenter-manager')();
                return dataCenterManager.storePackage(directoryPath).then((dataCenter) => {
                    var packageHash = dataCenter.packageHash;
                    var manifestFile = dataCenter.manifestFilePath;
                    return DeploymentsVersions.findOne({
                        where: { deployment_id: deploymentId, app_version: appVersion },
                    })
                        .then((deploymentsVersions) => {
                            if (!deploymentsVersions) {
                                return false;
                            }
                            return self.isMatchPackageHash(
                                deploymentsVersions.get('current_package_id'),
                                packageHash,
                            );
                        })
                        .then((isExist) => {
                            if (isExist) {
                                var e = new AppError(
                                    "The uploaded package is identical to the contents of the specified deployment's current release.",
                                );
                                logger.debug(e.message);
                                throw e;
                            }
                            return security.qetag(manifestFile);
                        })
                        .then((manifestHash) => {
                            return Promise.all([
                                common.uploadFileToStorage(manifestHash, manifestFile),
                                common.uploadFileToStorage(blobHash, filePath),
                            ]).then(() => [packageHash, manifestHash, blobHash]);
                        });
                });
            })
            .then(([packageHash, manifestHash, blobHash]) => {
                var stats = fs.statSync(filePath);
                var params = {
                    releaseMethod: RELEAS_EMETHOD_UPLOAD,
                    releaseUid: releaseUid,
                    isMandatory: isMandatory ? IS_MANDATORY_YES : IS_MANDATORY_NO,
                    isDisabled: isDisabled ? IS_DISABLED_YES : IS_DISABLED_NO,
                    rollout: rollout,
                    size: stats.size,
                    description: description,
                    min_version: versionInfo[1],
                    max_version: versionInfo[2],
                };
                return self.createPackage(
                    deploymentId,
                    appVersion,
                    packageHash,
                    manifestHash,
                    blobHash,
                    params,
                );
            })
            .finally(() => common.deleteFolderSync(directoryPathParent));
    }

    modifyReleasePackage(packageId, params) {
        var appVersion = _.get(params, 'appVersion');
        var description = _.get(params, 'description');
        var isMandatory = _.get(params, 'isMandatory');
        var isDisabled = _.get(params, 'isDisabled');
        var rollout = _.get(params, 'rollout');
        return Packages.findByPk(packageId)
            .then((packageInfo) => {
                if (!packageInfo) {
                    throw new AppError(`packageInfo not found`);
                }
                if (!_.isNull(appVersion)) {
                    var versionInfo = common.validatorVersion(appVersion);
                    if (!versionInfo[0]) {
                        throw new AppError(`--targetBinaryVersion ${appVersion} not support.`);
                    }
                    return Promise.all([
                        DeploymentsVersions.findOne({
                            where: {
                                deployment_id: packageInfo.deployment_id,
                                app_version: appVersion,
                            },
                        }),
                        DeploymentsVersions.findByPk(packageInfo.deployment_version_id),
                    ])
                        .then(([v1, v2]) => {
                            if (v1 && !_.eq(v1.id, v2.id)) {
                                throw new AppError(`${appVersion} already exist.`);
                            }
                            if (!v2) {
                                throw new AppError(`packages not found.`);
                            }
                            return DeploymentsVersions.update(
                                {
                                    app_version: appVersion,
                                    min_version: versionInfo[1],
                                    max_version: versionInfo[2],
                                },
                                { where: { id: v2.id } },
                            );
                        })
                        .then(() => {
                            return packageInfo;
                        });
                }
                return packageInfo;
            })
            .then((packageInfo) => {
                var new_params = {
                    description: description || packageInfo.description,
                } as PackagesInterface;
                if (_.isInteger(rollout)) {
                    new_params.rollout = rollout;
                }
                if (_.isBoolean(isMandatory)) {
                    new_params.is_mandatory = isMandatory ? IS_MANDATORY_YES : IS_MANDATORY_NO;
                }
                if (_.isBoolean(isDisabled)) {
                    new_params.is_disabled = isDisabled ? IS_DISABLED_YES : IS_DISABLED_NO;
                }
                return Packages.update(new_params, { where: { id: packageId } });
            });
    }

    promotePackage(sourceDeploymentInfo, destDeploymentInfo, params) {
        var self = this;
        var appVersion = _.get(params, 'appVersion', null);
        var label = _.get(params, 'label', null);
        return new Promise((resolve, reject) => {
            if (label) {
                return Packages.findOne({
                    where: { deployment_id: sourceDeploymentInfo.id, label: label },
                })
                    .then((sourcePack) => {
                        if (!sourcePack) {
                            throw new AppError('label does not exist.');
                        }
                        return DeploymentsVersions.findByPk(sourcePack.deployment_version_id).then(
                            (deploymentsVersions) => {
                                if (!deploymentsVersions) {
                                    throw new AppError('deploymentsVersions does not exist.');
                                }
                                resolve([sourcePack, deploymentsVersions]);
                            },
                        );
                    })
                    .catch((e) => {
                        reject(e);
                    });
            } else {
                var lastDeploymentVersionId = _.get(
                    sourceDeploymentInfo,
                    'last_deployment_version_id',
                    0,
                );
                if (_.lte(lastDeploymentVersionId, 0)) {
                    throw new AppError(`does not exist last_deployment_version_id.`);
                }
                return DeploymentsVersions.findByPk(lastDeploymentVersionId)
                    .then((deploymentsVersions) => {
                        var sourcePackId = _.get(deploymentsVersions, 'current_package_id', 0);
                        if (_.lte(sourcePackId, 0)) {
                            throw new AppError(`packageInfo not found.`);
                        }
                        return Packages.findByPk(sourcePackId).then((sourcePack) => {
                            if (!sourcePack) {
                                throw new AppError(`packageInfo not found.`);
                            }
                            resolve([sourcePack, deploymentsVersions]);
                        });
                    })
                    .catch((e) => {
                        reject(e);
                    });
            }
        })
            .then(([sourcePack, deploymentsVersions]) => {
                var appFinalVersion = appVersion || deploymentsVersions.app_version;
                logger.debug('sourcePack', sourcePack);
                logger.debug('deploymentsVersions', deploymentsVersions);
                logger.debug('appFinalVersion', appFinalVersion);
                return DeploymentsVersions.findOne({
                    where: {
                        deployment_id: destDeploymentInfo.id,
                        app_version: appFinalVersion,
                    },
                })
                    .then((destDeploymentsVersions) => {
                        if (!destDeploymentsVersions) {
                            return false;
                        }
                        return self.isMatchPackageHash(
                            destDeploymentsVersions.get('current_package_id'),
                            sourcePack.package_hash,
                        );
                    })
                    .then((isExist) => {
                        if (isExist) {
                            throw new AppError(
                                "The uploaded package is identical to the contents of the specified deployment's current release.",
                            );
                        }
                        return [sourcePack, deploymentsVersions, appFinalVersion];
                    });
            })
            .then(([sourcePack, deploymentsVersions, appFinalVersion]) => {
                var versionInfo = common.validatorVersion(appFinalVersion);
                if (!versionInfo[0]) {
                    logger.debug(`targetBinaryVersion ${appVersion} not support.`);
                    throw new AppError(`targetBinaryVersion ${appVersion} not support.`);
                }
                var create_params = {
                    releaseMethod: RELEAS_EMETHOD_PROMOTE,
                    releaseUid: params.promoteUid || 0,
                    rollout: params.rollout || 100,
                    size: sourcePack.size,
                    description: params.description || sourcePack.description,
                    originalLabel: sourcePack.label,
                    originalDeployment: sourceDeploymentInfo.name,
                    min_version: versionInfo[1],
                    max_version: versionInfo[2],
                    isMandatory: 0,
                    isDisabled: 0,
                };
                if (_.isBoolean(params.isMandatory)) {
                    create_params.isMandatory = params.isMandatory
                        ? IS_MANDATORY_YES
                        : IS_MANDATORY_NO;
                } else {
                    create_params.isMandatory = sourcePack.is_mandatory;
                }
                if (_.isBoolean(params.isDisabled)) {
                    create_params.isDisabled = params.isDisabled ? IS_DISABLED_YES : IS_DISABLED_NO;
                } else {
                    create_params.isDisabled = sourcePack.is_disabled;
                }
                return self.createPackage(
                    destDeploymentInfo.id,
                    appFinalVersion,
                    sourcePack.package_hash,
                    sourcePack.manifest_blob_url,
                    sourcePack.blob_url,
                    create_params,
                );
            });
    }

    rollbackPackage(deploymentVersionId, targetLabel, rollbackUid) {
        var self = this;
        return DeploymentsVersions.findByPk(deploymentVersionId).then((deploymentsVersions) => {
            if (!deploymentsVersions) {
                throw new AppError('您之前还没有发布过版本');
            }
            return Packages.findByPk(deploymentsVersions.current_package_id)
                .then((currentPackageInfo): Promise<[PackagesInterface, PackagesInterface[]]> => {
                    if (targetLabel) {
                        return Packages.findAll({
                            where: {
                                deployment_version_id: deploymentVersionId,
                                label: targetLabel,
                            },
                            limit: 1,
                        }).then((rollbackPackageInfos) => {
                            return [currentPackageInfo, rollbackPackageInfos];
                        });
                    } else {
                        return self
                            .getCanRollbackPackages(deploymentVersionId)
                            .then((rollbackPackageInfos) => {
                                return [currentPackageInfo, rollbackPackageInfos];
                            });
                    }
                })
                .then(([currentPackageInfo, rollbackPackageInfos]) => {
                    if (currentPackageInfo && rollbackPackageInfos.length > 0) {
                        for (var i = rollbackPackageInfos.length - 1; i >= 0; i--) {
                            if (
                                rollbackPackageInfos[i].package_hash !=
                                currentPackageInfo.package_hash
                            ) {
                                return rollbackPackageInfos[i];
                            }
                        }
                    }
                    throw new AppError('没有可供回滚的版本');
                })
                .then((rollbackPackage) => {
                    var params = {
                        releaseMethod: 'Rollback',
                        releaseUid: rollbackUid,
                        isMandatory: rollbackPackage.is_mandatory,
                        isDisabled: rollbackPackage.is_disabled,
                        rollout: rollbackPackage.rollout,
                        size: rollbackPackage.size,
                        description: rollbackPackage.description,
                        originalLabel: rollbackPackage.label,
                        originalDeployment: '',
                        min_version: deploymentsVersions.min_version,
                        max_version: deploymentsVersions.max_version,
                    };
                    return self.createPackage(
                        deploymentsVersions.deployment_id,
                        deploymentsVersions.app_version,
                        rollbackPackage.package_hash,
                        rollbackPackage.manifest_blob_url,
                        rollbackPackage.blob_url,
                        params,
                    );
                });
        });
    }

    getCanRollbackPackages(deploymentVersionId) {
        return Packages.findAll({
            where: {
                deployment_version_id: deploymentVersionId,
                release_method: {
                    [Op.in]: [RELEAS_EMETHOD_UPLOAD, RELEAS_EMETHOD_PROMOTE],
                },
            },
            order: [['id', 'desc']],
            limit: 2,
        });
    }
}

export const packageManager = new PackageManager();

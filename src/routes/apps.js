import express from 'express';
import _ from 'lodash';
import validator from 'validator';
import { config } from '../core/config';
import { logger } from 'kv-logger';

import { AppError } from '../core/app-error';
import { accountManager } from '../core/services/account-manager';
import { clientManager } from '../core/services/client-manager';

var middleware = require('../core/middleware');
var Deployments = require('../core/services/deployments');
var Collaborators = require('../core/services/collaborators');
var AppManager = require('../core/services/app-manager');
var PackageManager = require('../core/services/package-manager');
var common = require('../core/utils/common');

const router = express.Router();

function delay(ms) {
    return new Promise(function (resolve) {
        setTimeout(resolve, ms);
    });
}

router.get('/', middleware.checkToken, (req, res, next) => {
    var uid = req.users.id;
    var appManager = new AppManager();
    appManager
        .listApps(uid)
        .then((data) => {
            res.send({ apps: data });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.get('/:appName/deployments', middleware.checkToken, (req, res, next) => {
    var uid = req.users.id;
    var appName = _.trim(req.params.appName);
    var deployments = new Deployments();
    accountManager
        .collaboratorCan(uid, appName)
        .then((col) => {
            return deployments.listDeloyments(col.appid);
        })
        .then((data) => {
            res.send({ deployments: data });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.get('/:appName/deployments/:deploymentName', middleware.checkToken, (req, res, next) => {
    var uid = req.users.id;
    var appName = _.trim(req.params.appName);
    var deploymentName = _.trim(req.params.deploymentName);
    var deployments = new Deployments();
    accountManager
        .collaboratorCan(uid, appName)
        .then((col) => {
            return deployments.findDeloymentByName(deploymentName, col.appid);
        })
        .then((deploymentInfo) => {
            if (_.isEmpty(deploymentInfo)) {
                throw new AppError('does not find the deployment');
            }
            res.send({ deployment: deployments.listDeloyment(deploymentInfo) });
            return true;
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.post('/:appName/deployments', middleware.checkToken, (req, res, next) => {
    var uid = req.users.id;
    var appName = _.trim(req.params.appName);
    var name = req.body.name;
    var deployments = new Deployments();
    accountManager
        .ownerCan(uid, appName)
        .then((col) => {
            return deployments.addDeloyment(name, col.appid, uid);
        })
        .then((data) => {
            res.send({ deployment: { name: data.name, key: data.deployment_key } });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.get(
    '/:appName/deployments/:deploymentName/metrics',
    middleware.checkToken,
    (req, res, next) => {
        var uid = req.users.id;
        var appName = _.trim(req.params.appName);
        var deploymentName = _.trim(req.params.deploymentName);
        var deployments = new Deployments();
        var packageManager = new PackageManager();
        accountManager
            .collaboratorCan(uid, appName)
            .then((col) => {
                return deployments
                    .findDeloymentByName(deploymentName, col.appid)
                    .then((deploymentInfo) => {
                        if (_.isEmpty(deploymentInfo)) {
                            throw new AppError('does not find the deployment');
                        }
                        return deploymentInfo;
                    });
            })
            .then((deploymentInfo) => {
                return deployments.getAllPackageIdsByDeploymentsId(deploymentInfo.id);
            })
            .then((packagesInfos) => {
                return packagesInfos.reduce((prev, v) => {
                    return prev.then((result) => {
                        return packageManager.getMetricsbyPackageId(v.get('id')).then((metrics) => {
                            if (metrics) {
                                result[v.get('label')] = {
                                    active: metrics.get('active'),
                                    downloaded: metrics.get('downloaded'),
                                    failed: metrics.get('failed'),
                                    installed: metrics.get('installed'),
                                };
                            }
                            return result;
                        });
                    });
                }, Promise.resolve({}));
            })
            .then((rs) => {
                res.send({ metrics: rs });
            })
            .catch((e) => {
                if (e instanceof AppError) {
                    res.send({ metrics: null });
                } else {
                    next(e);
                }
            });
    },
);

router.get(
    '/:appName/deployments/:deploymentName/history',
    middleware.checkToken,
    (req, res, next) => {
        var uid = req.users.id;
        var appName = _.trim(req.params.appName);
        var deploymentName = _.trim(req.params.deploymentName);
        var deployments = new Deployments();
        accountManager
            .collaboratorCan(uid, appName)
            .then((col) => {
                return deployments
                    .findDeloymentByName(deploymentName, col.appid)
                    .then((deploymentInfo) => {
                        if (_.isEmpty(deploymentInfo)) {
                            throw new AppError('does not find the deployment');
                        }
                        return deploymentInfo;
                    });
            })
            .then((deploymentInfo) => {
                return deployments.getDeploymentHistory(deploymentInfo.id);
            })
            .then((rs) => {
                res.send({ history: _.pullAll(rs, [null, false]) });
            })
            .catch((e) => {
                if (e instanceof AppError) {
                    res.status(406).send(e.message);
                } else {
                    next(e);
                }
            });
    },
);

router.delete(
    '/:appName/deployments/:deploymentName/history',
    middleware.checkToken,
    (req, res, next) => {
        var uid = req.users.id;
        var appName = _.trim(req.params.appName);
        var deploymentName = _.trim(req.params.deploymentName);
        var deployments = new Deployments();
        accountManager
            .ownerCan(uid, appName)
            .then((col) => {
                return deployments
                    .findDeloymentByName(deploymentName, col.appid)
                    .then((deploymentInfo) => {
                        if (_.isEmpty(deploymentInfo)) {
                            throw new AppError('does not find the deployment');
                        }
                        return deploymentInfo;
                    });
            })
            .then((deploymentInfo) => {
                return deployments.deleteDeploymentHistory(deploymentInfo.id);
            })
            .then((rs) => {
                res.send('ok');
            })
            .catch((e) => {
                if (e instanceof AppError) {
                    res.status(406).send(e.message);
                } else {
                    next(e);
                }
            });
    },
);

router.patch('/:appName/deployments/:deploymentName', middleware.checkToken, (req, res, next) => {
    var name = req.body.name;
    var appName = _.trim(req.params.appName);
    var deploymentName = _.trim(req.params.deploymentName);
    var uid = req.users.id;
    var deployments = new Deployments();
    accountManager
        .ownerCan(uid, appName)
        .then((col) => {
            return deployments.renameDeloymentByName(deploymentName, col.appid, name);
        })
        .then((data) => {
            res.send({ deployment: data });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.delete('/:appName/deployments/:deploymentName', middleware.checkToken, (req, res, next) => {
    var appName = _.trim(req.params.appName);
    var deploymentName = _.trim(req.params.deploymentName);
    var uid = req.users.id;
    var deployments = new Deployments();
    accountManager
        .ownerCan(uid, appName)
        .then((col) => {
            return deployments.deleteDeloymentByName(deploymentName, col.appid);
        })
        .then((data) => {
            res.send({ deployment: data });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.post(
    '/:appName/deployments/:deploymentName/release',
    middleware.checkToken,
    (req, res, next) => {
        var appName = _.trim(req.params.appName);
        var deploymentName = _.trim(req.params.deploymentName);
        var uid = req.users.id;

        logger.info('try to release', {
            uid,
            appName,
            deploymentName,
        });
        var deployments = new Deployments();
        var packageManager = new PackageManager();
        accountManager
            .collaboratorCan(uid, appName)
            .then((col) => {
                logger.debug('release user check pass', {
                    uid,
                    appName,
                    deploymentName,
                });

                return deployments
                    .findDeloymentByName(deploymentName, col.appid)
                    .then((deploymentInfo) => {
                        if (_.isEmpty(deploymentInfo)) {
                            logger.debug(`does not find the deployment`);
                            throw new AppError('does not find the deployment');
                        }
                        logger.debug('release deployment check ok', {
                            uid,
                            appName,
                            deploymentName,
                        });

                        return packageManager
                            .parseReqFile(req)
                            .then((data) => {
                                if (data.package.mimetype != 'application/zip') {
                                    logger.debug(`upload file type is invlidate`, data.package);
                                    throw new AppError('upload file type is invalidate');
                                }
                                logger.debug('release packagee parse ok', {
                                    uid,
                                    appName,
                                    deploymentName,
                                });

                                return packageManager
                                    .releasePackage(
                                        deploymentInfo.appid,
                                        deploymentInfo.id,
                                        data.packageInfo,
                                        data.package.filepath,
                                        uid,
                                    )
                                    .finally(() => {
                                        common.deleteFolderSync(data.package.filepath);
                                    });
                            })
                            .then((packages) => {
                                if (packages) {
                                    delay(1000).then(() => {
                                        packageManager
                                            .createDiffPackagesByLastNums(
                                                deploymentInfo.appid,
                                                packages,
                                                _.get(config, 'common.diffNums', 1),
                                            )
                                            .catch((e) => {
                                                logger.error(e);
                                            });
                                    });
                                }
                                //clear cache if exists.
                                if (_.get(config, 'common.updateCheckCache', false) !== false) {
                                    delay(2500).then(() => {
                                        clientManager.clearUpdateCheckCache(
                                            deploymentInfo.deployment_key,
                                            '*',
                                            '*',
                                            '*',
                                        );
                                    });
                                }
                                return null;
                            });
                    });
            })
            .then(() => {
                logger.info('release success', {
                    uid,
                    appName,
                    deploymentName,
                });

                res.send('{"msg": "succeed"}');
            })
            .catch((e) => {
                if (e instanceof AppError) {
                    logger.warn(e.message);
                    res.status(406).send(e.message);
                } else {
                    next(e);
                }
            });
    },
);

router.patch(
    '/:appName/deployments/:deploymentName/release',
    middleware.checkToken,
    (req, res, next) => {
        logger.debug('req.body', req.body);
        var appName = _.trim(req.params.appName);
        var deploymentName = _.trim(req.params.deploymentName);
        var uid = req.users.id;
        var deployments = new Deployments();
        var packageManager = new PackageManager();
        var label = _.get(req, 'body.packageInfo.label');
        accountManager
            .collaboratorCan(uid, appName)
            .then((col) => {
                return deployments
                    .findDeloymentByName(deploymentName, col.appid)
                    .then((deploymentInfo) => {
                        if (_.isEmpty(deploymentInfo)) {
                            throw new AppError('does not find the deployment');
                        }
                        if (label) {
                            return packageManager
                                .findPackageInfoByDeploymentIdAndLabel(deploymentInfo.id, label)
                                .then((data) => {
                                    return [deploymentInfo, data];
                                });
                        } else {
                            var deploymentVersionId = deploymentInfo.last_deployment_version_id;
                            return packageManager
                                .findLatestPackageInfoByDeployVersion(deploymentVersionId)
                                .then((data) => {
                                    return [deploymentInfo, data];
                                });
                        }
                    })
                    .then(([deploymentInfo, packageInfo]) => {
                        if (!packageInfo) {
                            throw new AppError('does not find the packageInfo');
                        }
                        return packageManager
                            .modifyReleasePackage(packageInfo.id, _.get(req, 'body.packageInfo'))
                            .then(() => {
                                //clear cache if exists.
                                if (_.get(config, 'common.updateCheckCache', false) !== false) {
                                    delay(2500).then(() => {
                                        clientManager.clearUpdateCheckCache(
                                            deploymentInfo.deployment_key,
                                            '*',
                                            '*',
                                            '*',
                                        );
                                    });
                                }
                            });
                    });
            })
            .then((data) => {
                res.send('');
            })
            .catch((e) => {
                if (e instanceof AppError) {
                    res.status(406).send(e.message);
                } else {
                    next(e);
                }
            });
    },
);

router.post(
    '/:appName/deployments/:sourceDeploymentName/promote/:destDeploymentName',
    middleware.checkToken,
    (req, res, next) => {
        logger.debug('req.body:', req.body);
        var appName = _.trim(req.params.appName);
        var sourceDeploymentName = _.trim(req.params.sourceDeploymentName);
        var destDeploymentName = _.trim(req.params.destDeploymentName);
        var uid = req.users.id;
        var packageManager = new PackageManager();
        var deployments = new Deployments();
        accountManager
            .collaboratorCan(uid, appName)
            .then((col) => {
                var appId = col.appid;
                return Promise.all([
                    deployments.findDeloymentByName(sourceDeploymentName, appId),
                    deployments.findDeloymentByName(destDeploymentName, appId),
                ])
                    .then(([sourceDeploymentInfo, destDeploymentInfo]) => {
                        if (!sourceDeploymentInfo) {
                            throw new AppError(`${sourceDeploymentName}  does not exist.`);
                        }
                        if (!destDeploymentInfo) {
                            throw new AppError(`${destDeploymentName}  does not exist.`);
                        }
                        return [sourceDeploymentInfo, destDeploymentInfo];
                    })
                    .then(([sourceDeploymentInfo, destDeploymentInfo]) => {
                        var params = _.get(req.body, 'packageInfo', {});
                        _.set(params, 'promoteUid', uid);
                        return [
                            packageManager.promotePackage(
                                sourceDeploymentInfo,
                                destDeploymentInfo,
                                params,
                            ),
                            destDeploymentInfo,
                        ];
                    })
                    .then(([packages, destDeploymentInfo]) => {
                        if (packages) {
                            delay(1000).then(() => {
                                packageManager
                                    .createDiffPackagesByLastNums(
                                        destDeploymentInfo.appid,
                                        packages,
                                        _.get(config, 'common.diffNums', 1),
                                    )
                                    .catch((e) => {
                                        logger.error(e);
                                    });
                            });
                        }
                        //clear cache if exists.
                        if (_.get(config, 'common.updateCheckCache', false) !== false) {
                            delay(2500).then(() => {
                                clientManager.clearUpdateCheckCache(
                                    destDeploymentInfo.deployment_key,
                                    '*',
                                    '*',
                                    '*',
                                );
                            });
                        }
                        return packages;
                    });
            })
            .then((packages) => {
                res.send({ package: packages });
            })
            .catch((e) => {
                if (e instanceof AppError) {
                    res.status(406).send(e.message);
                } else {
                    next(e);
                }
            });
    },
);

var rollbackCb = function (req, res, next) {
    var appName = _.trim(req.params.appName);
    var deploymentName = _.trim(req.params.deploymentName);
    var uid = req.users.id;
    var targetLabel = _.trim(_.get(req, 'params.label'));
    logger.info('try to rollback', {
        uid,
        appName,
        deploymentName,
        targetLabel,
    });
    var deployments = new Deployments();
    var packageManager = new PackageManager();
    accountManager
        .collaboratorCan(uid, appName)
        .then((col) => {
            return deployments.findDeloymentByName(deploymentName, col.appid);
        })
        .then((dep) => {
            return packageManager
                .rollbackPackage(dep.last_deployment_version_id, targetLabel, uid)
                .then((packageInfo) => {
                    if (packageInfo) {
                        delay(1000).then(() => {
                            packageManager
                                .createDiffPackagesByLastNums(dep.appid, packageInfo, 1)
                                .catch((e) => {
                                    logger.error(e);
                                });
                        });
                    }
                    //clear cache if exists.
                    if (_.get(config, 'common.updateCheckCache', false) !== false) {
                        delay(2500).then(() => {
                            clientManager.clearUpdateCheckCache(dep.deployment_key, '*', '*', '*');
                        });
                    }
                    return packageInfo;
                });
        })
        .then(() => {
            logger.info('rollback success', {
                uid,
                appName,
                deploymentName,
                targetLabel,
            });

            res.send('ok');
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
};

router.post('/:appName/deployments/:deploymentName/rollback', middleware.checkToken, rollbackCb);

router.post(
    '/:appName/deployments/:deploymentName/rollback/:label',
    middleware.checkToken,
    rollbackCb,
);

router.get('/:appName/collaborators', middleware.checkToken, (req, res, next) => {
    var appName = _.trim(req.params.appName);
    var uid = req.users.id;
    var collaborators = new Collaborators();
    accountManager
        .collaboratorCan(uid, appName)
        .then((col) => {
            return collaborators.listCollaborators(col.appid);
        })
        .then((data) => {
            const rs = _.reduce(
                data,
                (result, value, key) => {
                    if (_.eq(key, req.users.email)) {
                        value.isCurrentAccount = true;
                    } else {
                        value.isCurrentAccount = false;
                    }
                    result[key] = value;
                    return result;
                },
                {},
            );
            res.send({ collaborators: rs });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.post('/:appName/collaborators/:email', middleware.checkToken, (req, res, next) => {
    var appName = _.trim(req.params.appName);
    var email = _.trim(req.params.email);
    var uid = req.users.id;
    if (!validator.isEmail(email)) {
        return res.status(406).send('Invalid Email!');
    }
    var collaborators = new Collaborators();
    accountManager
        .ownerCan(uid, appName)
        .then((col) => {
            return accountManager.findUserByEmail(email).then((data) => {
                return collaborators.addCollaborator(col.appid, data.id);
            });
        })
        .then((data) => {
            res.send(data);
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.delete('/:appName/collaborators/:email', middleware.checkToken, (req, res, next) => {
    var appName = _.trim(req.params.appName);
    var email = _.trim(decodeURI(req.params.email));
    var uid = req.users.id;
    if (!validator.isEmail(email)) {
        return res.status(406).send('Invalid Email!');
    }
    var collaborators = new Collaborators();
    accountManager
        .ownerCan(uid, appName)
        .then((col) => {
            return accountManager.findUserByEmail(email).then((data) => {
                if (_.eq(data.id, uid)) {
                    throw new AppError("can't delete yourself!");
                } else {
                    return collaborators.deleteCollaborator(col.appid, data.id);
                }
            });
        })
        .then(() => {
            res.send('');
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.delete('/:appName', middleware.checkToken, (req, res, next) => {
    var appName = _.trim(req.params.appName);
    var uid = req.users.id;
    logger.info('try remove app', {
        uid,
        appName,
    });

    var appManager = new AppManager();
    accountManager
        .ownerCan(uid, appName)
        .then((col) => {
            return appManager.deleteApp(col.appid);
        })
        .then((data) => {
            logger.info('remove app success', {
                uid,
                appName,
            });

            res.send(data);
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.patch('/:appName', middleware.checkToken, (req, res, next) => {
    var newAppName = _.trim(req.body.name);
    var appName = _.trim(req.params.appName);
    var uid = req.users.id;
    logger.info('try rename app', {
        uid,
        appName,
        newAppName,
    });
    if (_.isEmpty(newAppName)) {
        return res.status(406).send('Please input name!');
    } else {
        var appManager = new AppManager();
        return accountManager
            .ownerCan(uid, appName)
            .then((col) => {
                return appManager.findAppByName(uid, newAppName).then((appInfo) => {
                    if (!_.isEmpty(appInfo)) {
                        throw new AppError(newAppName + ' Exist!');
                    }
                    return appManager.modifyApp(col.appid, { name: newAppName });
                });
            })
            .then(() => {
                logger.info('rename app success', {
                    uid,
                    appName,
                    newAppName,
                });

                res.send('');
            })
            .catch((e) => {
                if (e instanceof AppError) {
                    res.status(406).send(e.message);
                } else {
                    next(e);
                }
            });
    }
});

router.post('/:appName/transfer/:email', middleware.checkToken, (req, res, next) => {
    var appName = _.trim(req.params.appName);
    var email = _.trim(req.params.email);
    var uid = req.users.id;
    if (!validator.isEmail(email)) {
        return res.status(406).send('Invalid Email!');
    }
    return accountManager
        .ownerCan(uid, appName)
        .then((col) => {
            return accountManager.findUserByEmail(email).then((data) => {
                if (_.eq(data.id, uid)) {
                    throw new AppError("You can't transfer to yourself!");
                }
                var appManager = new AppManager();
                return appManager.transferApp(col.appid, uid, data.id);
            });
        })
        .then((data) => {
            res.send(data);
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.post('/', middleware.checkToken, (req, res, next) => {
    var uid = req.users.id;
    logger.info('try add app', {
        uid,
        ...req.body,
    });
    var constName = require('../core/const');
    var appName = req.body.name;
    if (_.isEmpty(appName)) {
        return res.status(406).send('Please input name!');
    }
    var osName = _.toLower(req.body.os);
    var os;
    if (osName == _.toLower(constName.IOS_NAME)) {
        os = constName.IOS;
    } else if (osName == _.toLower(constName.ANDROID_NAME)) {
        os = constName.ANDROID;
    } else if (osName == _.toLower(constName.WINDOWS_NAME)) {
        os = constName.WINDOWS;
    } else {
        return res.status(406).send('Please input os [iOS|Android|Windows]!');
    }
    var platformName = _.toLower(req.body.platform);
    var platform;
    if (platformName == _.toLower(constName.REACT_NATIVE_NAME)) {
        platform = constName.REACT_NATIVE;
    } else if (platformName == _.toLower(constName.CORDOVA_NAME)) {
        platform = constName.CORDOVA;
    } else {
        return res.status(406).send('Please input platform [React-Native|Cordova]!');
    }
    var manuallyProvisionDeployments = req.body.manuallyProvisionDeployments;
    var appManager = new AppManager();

    appManager
        .findAppByName(uid, appName)
        .then((appInfo) => {
            if (!_.isEmpty(appInfo)) {
                throw new AppError(appName + ' Exist!');
            }
            return appManager.addApp(uid, appName, os, platform, req.users.identical).then(() => {
                return {
                    name: appName,
                    collaborators: { [req.users.email]: { permission: 'Owner' } },
                };
            });
        })
        .then((data) => {
            logger.info('add app success', {
                uid,
                name: appName,
            });
            res.send({ app: data });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

module.exports = router;

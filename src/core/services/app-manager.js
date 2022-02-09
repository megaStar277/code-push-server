import _ from 'lodash';

import { Apps } from '../../models/apps';
import { Collaborators } from '../../models/collaborators';
import { Deployments } from '../../models/deployments';
import { Users } from '../../models/users';
import { sequelize } from '../utils/connections';
import { AppError } from '../app-error';

var security = require('../../core/utils/security');

var proto = (module.exports = function () {
    function AppManager() {}
    AppManager.__proto__ = proto;
    return AppManager;
});

proto.findAppByName = function (uid, appName) {
    return Apps.findOne({ where: { name: appName, uid: uid } });
};

proto.addApp = function (uid, appName, os, platform, identical) {
    return sequelize.transaction((t) => {
        return Apps.create(
            {
                name: appName,
                uid: uid,
                os: os,
                platform: platform,
            },
            {
                transaction: t,
            },
        ).then((apps) => {
            var constName = require('../const');
            var appId = apps.id;
            var deployments = [];
            var deploymentKey = security.randToken(28) + identical;
            deployments.push({
                appid: appId,
                name: constName.PRODUCTION,
                last_deployment_version_id: 0,
                label_id: 0,
                deployment_key: deploymentKey,
            });
            deploymentKey = security.randToken(28) + identical;
            deployments.push({
                appid: appId,
                name: constName.STAGING,
                last_deployment_version_id: 0,
                label_id: 0,
                deployment_key: deploymentKey,
            });
            return Promise.all([
                Collaborators.create(
                    { appid: appId, uid: uid, roles: 'Owner' },
                    { transaction: t },
                ),
                Deployments.bulkCreate(deployments, { transaction: t }),
            ]);
        });
    });
};

proto.deleteApp = function (appId) {
    return sequelize.transaction((t) => {
        return Promise.all([
            Apps.destroy({ where: { id: appId }, transaction: t }),
            Collaborators.destroy({ where: { appid: appId }, transaction: t }),
            Deployments.destroy({ where: { appid: appId }, transaction: t }),
        ]);
    });
};

proto.modifyApp = function (appId, params) {
    return Apps.update(params, { where: { id: appId } }).then(([affectedCount, affectedRows]) => {
        if (!_.gt(affectedCount, 0)) {
            throw AppError('modify errors');
        }
        return affectedCount;
    });
};

proto.transferApp = function (appId, fromUid, toUid) {
    return sequelize.transaction((t) => {
        return Promise.all([
            Apps.update({ uid: toUid }, { where: { id: appId }, transaction: t }),
            Collaborators.destroy({ where: { appid: appId, uid: fromUid }, transaction: t }),
            Collaborators.destroy({ where: { appid: appId, uid: toUid }, transaction: t }),
            Collaborators.create({ appid: appId, uid: toUid, roles: 'Owner' }, { transaction: t }),
        ]);
    });
};

proto.listApps = function (uid) {
    const self = this;
    return Collaborators.findAll({ where: { uid: uid } })
        .then((data) => {
            if (_.isEmpty(data)) {
                return [];
            } else {
                var appIds = _.map(data, (v) => {
                    return v.appid;
                });
                var Sequelize = require('sequelize');
                return Apps.findAll({ where: { id: { [Sequelize.Op.in]: appIds } } });
            }
        })
        .then((appInfos) => {
            var rs = Promise.all(
                _.values(appInfos).map((v) => {
                    return self.getAppDetailInfo(v, uid).then((info) => {
                        var constName = require('../const');
                        if (info.os == constName.IOS) {
                            info.os = constName.IOS_NAME;
                        } else if (info.os == constName.ANDROID) {
                            info.os = constName.ANDROID_NAME;
                        } else if (info.os == constName.WINDOWS) {
                            info.os = constName.WINDOWS_NAME;
                        }
                        if (info.platform == constName.REACT_NATIVE) {
                            info.platform = constName.REACT_NATIVE_NAME;
                        } else if (info.platform == constName.CORDOVA) {
                            info.platform = constName.CORDOVA_NAME;
                        }
                        return info;
                    });
                }),
            );
            return rs;
        });
};

proto.getAppDetailInfo = function (appInfo, currentUid) {
    var appId = appInfo.get('id');
    return Promise.all([
        Deployments.findAll({ where: { appid: appId } }),
        Collaborators.findAll({ where: { appid: appId } }).then((collaboratorInfos) => {
            return collaboratorInfos.reduce((prev, collaborator) => {
                return prev.then((allCol) => {
                    return Users.findOne({ where: { id: collaborator.get('uid') } }).then((u) => {
                        var isCurrentAccount = false;
                        if (_.eq(u.get('id'), currentUid)) {
                            isCurrentAccount = true;
                        }
                        allCol[u.get('email')] = {
                            permission: collaborator.get('roles'),
                            isCurrentAccount: isCurrentAccount,
                        };
                        return allCol;
                    });
                });
            }, Promise.resolve({}));
        }),
    ]).then(([deploymentInfos, collaborators]) => {
        return {
            collaborators,
            deployments: _.map(deploymentInfos, (item) => {
                return _.get(item, 'name');
            }),
            os: appInfo.get('os'),
            platform: appInfo.get('platform'),
            name: appInfo.get('name'),
            id: appInfo.get('id'),
        };
    });
};

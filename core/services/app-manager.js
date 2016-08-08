'use strict';
var Promise = require('bluebird');
var models = require('../../models');
var _ = require('lodash');
var security = require('../../core/utils/security');

var proto = module.exports = function (){
  function AppManager() {

  }
  AppManager.__proto__ = proto;
  return AppManager;
};

proto.findAppByName = function (uid, appName) {
  return models.Apps.findOne({where: {name: appName, uid: uid}});
};

proto.addApp = function (uid, appName, identical) {
  return models.sequelize.transaction(function (t) {
    return models.Apps.create({
      name: appName,
      uid: uid
    },{
      transaction: t
    })
    .then(function (apps) {
      var appId = apps.id;
      var deployments = [];
      var deploymentKey = security.randToken(28) + identical;
      deployments.push({
        appid: appId,
        name: 'Production',
        last_deployment_version_id: 0,
        label_id: 0,
        deployment_key: deploymentKey
      });
      deploymentKey = security.randToken(28) + identical;
      deployments.push({
        appid: appId,
        name: 'Staging',
        last_deployment_version_id: 0,
        label_id: 0,
        deployment_key: deploymentKey
      });
      return Promise.all([
        models.Collaborators.create({appid: appId, uid: uid, roles: "Owner"}, {transaction: t}),
        models.Deployments.bulkCreate(deployments, {transaction: t})
      ]);
    });
  });
};

proto.deleteApp = function (appId) {
  return models.sequelize.transaction(function (t) {
    return Promise.all([
      models.Apps.destroy({where: {id: appId}, transaction: t}),
      models.Collaborators.destroy({where: {appid: appId}, transaction: t}),
      models.Deployments.destroy({where: {appid: appId}, transaction: t})
    ]);
  });
};

proto.modifyApp = function (appId, params) {
  return models.Apps.update(params, {where: {id:appId}})
  .spread(function (affectedCount, affectedRows) {
    if (!_.gt(affectedCount, 0)) {
      throw Error('modify errors');
    }
    return affectedCount;
  });
};

proto.transferApp = function (appId, fromUid, toUid) {
  return models.sequelize.transaction(function (t) {
    return Promise.all([
      models.Apps.update({uid: toUid}, {where: {id: appId}, transaction: t}),
      models.Collaborators.destroy({where: {appid: appId, uid: fromUid}, transaction: t}),
      models.Collaborators.destroy({where: {appid: appId, uid: toUid}, transaction: t}),
      models.Collaborators.create({appid: appId, uid: toUid, roles: "Owner"}, {transaction: t})
    ]);
  });
};

proto.listApps = function (uid) {
  let self = this;
  return models.Collaborators.findAll({where : {uid: uid}})
  .then(function(data){
    if (_.isEmpty(data)){
      return [];
    } else {
      var appIds = _.map(data, function(v){ return v.appid });
      return models.Apps.findAll({where: {id: {in: appIds}}});
    }
  })
  .then(function (appInfos) {
    var rs = Promise.map(_.values(appInfos), function(v){
      return self.getAppDetailInfo(v, uid)
      .then(function (info) {
        return info;
      });
    });
    return rs;
  });
};

proto.getAppDetailInfo  = function (appInfo, currentUid) {
  var appId = appInfo.get('id');
  return Promise.all([
    models.Deployments.findAll({where: {appid: appId}}),
    models.Collaborators.findAll({where: {appid: appId}}),
  ])
  .spread(function (deploymentInfos, collaboratorInfos) {
    return Promise.props({
      collaborators: Promise.reduce(collaboratorInfos, function (allCol, collaborator) {
        return models.Users.findOne({where: {id: collaborator.get('uid')}})
        .then(function (u) {
          var isCurrentAccount = false;
          if (_.eq(u.get('id'), currentUid)) {
            isCurrentAccount = true;
          }
          allCol[u.get('email')] = {permission: collaborator.get('roles'), isCurrentAccount: isCurrentAccount};
          return allCol;
        });
      }, {}),

      deployments: _.map(deploymentInfos, function (item) {
        return _.get(item, 'name');
      }),

      name: appInfo.get('name')
    });
  });
};

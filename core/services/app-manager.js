'use strict';
var Q = require('q');
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
    }).then(function (apps) {
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
      return Q.allSettled([
        models.Collaborators.create({appid: appId, uid: uid, roles: "Owner"}, {transaction: t}),
        models.Deployments.bulkCreate(deployments, {transaction: t})
      ]);
    });
  });
};

proto.deleteApp = function (appId) {
  return models.sequelize.transaction(function (t) {
    return Q.allSettled([
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
    return Q.allSettled([
      models.Apps.update({uid: toUid}, {where: {id: appId}, transaction: t}),
      models.Collaborators.destroy({where: {appid: appId, uid: fromUid}, transaction: t}),
      models.Collaborators.destroy({where: {appid: appId, uid: toUid}, transaction: t}),
      models.Collaborators.create({appid: appId, uid: toUid, roles: "Owner"}, {transaction: t})
    ]);
  });
};

proto.listApps = function (uid) {
  return models.Collaborators.findAll({where : {uid: uid}}).then(function(data){
    if (_.isEmpty(data)){
      throw new Error('You are not Collaborator in any apps.');
    }else {
      return [data, data.map(function(v){ return v.appid })];
    }
  }).spread(function (collaboratorInfos, appids) {
    return models.Apps.findAll({where: {id: {in: appids}}}).then(function(appInfos) {
      if (_.isEmpty(appInfos)) {
        throw new Error('can\'t find apps info.');
      }else {
        var appInfos = _.reduce(appInfos, function(result, value, key) {
          result[value.id] = value;
          return result;
        }, {});
        return [collaboratorInfos, appInfos];
      }
    });
  }).spread(function (collaboratorInfos, appInfos) {
    var ownerIds = _.map(appInfos, function (v) {
      return v.uid;
    });
    return models.Users.findAll({where: {id: {in: ownerIds}}}).then(function (data) {
      var userInfos = _.reduce(data, function(result, value, key) {
        result[value.id] = value;
        return result;
      }, {});
      return userInfos;
    }).then(function (userInfos) {
      var rs = _.map(appInfos, function(v, key){
        var collaborators = {};
        if (_.eq(v.uid, uid)) {
           var bo = {permission: 'Owner', isCurrentAccount: true};
        } else {
           var bo = {permission: 'Owner', isCurrentAccount: false};
        }
        var email = userInfos[v.uid] ? userInfos[v.uid].email : req.users.email;
        collaborators[email + ""] = bo;
        return {collaborators: collaborators, name: v.name};
      });
      return rs;
    });
  });
};

'use strict';
var Promise = require('bluebird');
var models = require('../../models');
var security = require('../../core/utils/security');
var common = require('../../core/utils/common');
var PackageManager = require('./package-manager');
var _ = require('lodash');
var moment = require('moment');

var proto = module.exports = function (){
  function Deployments() {

  }
  Deployments.__proto__ = proto;
  return Deployments;
};

proto.getAllPackageIdsByDeploymentsId = function(deploymentsId) {
  return models.Packages.findAll({where: {deployment_id: deploymentsId}});
};

proto.existDeloymentName = function (appId, name) {
  return models.Deployments.findOne({where: {appid: appId, name: name}})
  .then(function (data) {
    if (!_.isEmpty(data)){
      throw new Error(name + " name does Exist!")
    } else {
      return data;
    }
  });
};

proto.addDeloyment = function (name, appId, uid) {
  var self = this;
  return models.Users.findById(uid)
  .then(function (user) {
    if (_.isEmpty(user)) {
      throw new Error('can\'t find user');
    }
    return self.existDeloymentName(appId, name)
    .then(function () {
      var identical = user.identical;
      var deploymentKey = security.randToken(28) + identical;
      return models.Deployments.create({
        appid: appId,
        name: name,
        deployment_key: deploymentKey,
        last_deployment_version_id: 0,
        label_id: 0
      });
    });
  });
};

proto.renameDeloymentByName = function (deploymentName, appId, newName) {
  return this.existDeloymentName(appId, newName)
  .then(function () {
    return models.Deployments.update(
      {name: newName},
      {where: {name: deploymentName,appid: appId}
    })
    .spread(function (affectedCount, affectedRow) {
      if (_.gt(affectedCount, 0)) {
        return {name: newName};
      } else {
        throw new Error('does not find the deployment');
      }
    });
  });
};

proto.deleteDeloymentByName = function (deploymentName, appId) {
  return models.Deployments.destroy({
    where: {name: deploymentName, appid: appId}
  })
  .then(function (rowNum) {
    if (_.gt(rowNum, 0)) {
      return {name: `${deploymentName}`};
    } else {
      throw new Error('does not find the deployment');
    }
  });
};

proto.findDeloymentByName = function (deploymentName, appId) {
  return models.Deployments.findOne({
    where: {name: deploymentName, appid: appId}
  });
};

proto.findPackagesAndOtherInfos = function (packageId) {
  return models.Packages.findOne({
    where: {id: packageId}
  })
  .then(function (packageInfo) {
    if (!packageInfo) {
      return null;
    }
    return Promise.props({
      packageInfo: packageInfo,
      packageDiffMap: models.PackagesDiff.findAll({where: {package_id: packageId}})
      .then(function(diffs){
        if (diffs.length > 0) {
          return _.reduce(diffs, function(result, v){
            result[_.get(v, 'diff_against_package_hash')] = {
              size: _.get(v, 'diff_size'),
              url: common.getBlobDownloadUrl(_.get(v, 'diff_blob_url')),
            };
            return result;
          }, {});
        }
        return null;
      }),
      userInfo: models.Users.findOne({where: {id: packageInfo.released_by}}),
      deploymentsVersions: models.DeploymentsVersions.findById(packageInfo.deployment_version_id)
    });
  });
};

proto.findDeloymentsPackages = function (deploymentsVersionsId) {
  var self = this;
  return models.DeploymentsVersions.findOne({where: {id: deploymentsVersionsId}})
  .then(function(deploymentsVersionsInfo) {
    if (deploymentsVersionsInfo) {
      return self.findPackagesAndOtherInfos(deploymentsVersionsInfo.current_package_id);
    }
    return null;
  });
};

proto.formatPackage = function(packageVersion) {
  if (!packageVersion) {
    return null;
  }
  return {
    description: _.get(packageVersion, "packageInfo.description"),
    isDisabled: false,
    isMandatory: _.get(packageVersion, "deploymentsVersions.is_mandatory") == 2 ? true : false,
    rollout: 100,
    appVersion: _.get(packageVersion, "deploymentsVersions.app_version"),
    packageHash: _.get(packageVersion, "packageInfo.package_hash"),
    blobUrl: common.getBlobDownloadUrl(_.get(packageVersion, "packageInfo.blob_url")),
    size: _.get(packageVersion, "packageInfo.size"),
    manifestBlobUrl: common.getBlobDownloadUrl(_.get(packageVersion, "packageInfo.manifest_blob_url")),
    diffPackageMap: _.get(packageVersion, 'packageDiffMap'),
    releaseMethod: _.get(packageVersion, "packageInfo.release_method"),
    uploadTime: parseInt(moment(_.get(packageVersion, "packageInfo.updated_at")).format('x')),
    originalLabel: _.get(packageVersion, "packageInfo.original_label"),
    originalDeployment: _.get(packageVersion, "packageInfo.original_deployment"),
    label: _.get(packageVersion, "packageInfo.label"),
    releasedBy: _.get(packageVersion, "userInfo.email"),
  };
};

proto.listDeloyments = function (appId) {
  var self = this;
  return models.Deployments.findAll({where: {appid: appId}})
  .then(function(deploymentsInfos){
    if (_.isEmpty(deploymentsInfos)) {
      return [];
    }
    return Promise.map(deploymentsInfos, function (v) {
      return Promise.props({
        createdTime: parseInt(moment(v.created_at).format('x')),
        id: `${v.id}`,
        key: v.deployment_key,
        name: v.name,
        package: self.findDeloymentsPackages([v.last_deployment_version_id]).then(self.formatPackage)
      });
    })
  });
};

proto.getDeploymentHistory = function (deploymentId) {
  var self = this;
  return models.DeploymentsHistory.findAll({where: {deployment_id: deploymentId}, order: [['id','desc']], limit: 15})
  .then(function(history) {
    return _.map(history, function(v){ return v.package_id});
  })
  .then(function(packageIds){
    return Promise.map(packageIds, function(v) {
      return self.findPackagesAndOtherInfos(v).then(self.formatPackage);
    });
  });
};

proto.deleteDeploymentHistory = function(deploymentId) {
  return models.DeploymentsHistory.findAll({where: {deployment_id: deploymentId }, order: [['id','desc']], limit: 100})
  .then(function(rs){
    return Promise.map(rs, function(v){
      return v.destroy();
    });
  });
}



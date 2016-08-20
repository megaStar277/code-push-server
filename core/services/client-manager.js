'use strict';
var Promise = require('bluebird');
var models = require('../../models');
var _ = require('lodash');
var common = require('../utils/common');

var proto = module.exports = function (){
  function ClientManager() {

  }
  ClientManager.__proto__ = proto;
  return ClientManager;
};

proto.updateCheck = function(deploymentKey, appVersion, label, packageHash) {
  var rs = {
    downloadURL: "",
    description: "",
    isAvailable: false,
    isMandatory: false,
    appVersion: "1.0.1",
    packageHash: "",
    label: "",
    packageSize: 0,
    updateAppVersion: false,
    shouldRunBinaryVersion: false
  };
  if (_.isEmpty(deploymentKey) || _.isEmpty(appVersion)) {
    return Promise.reject(new Error("please input deploymentKey and appVersion"))
  }
  return models.Deployments.findOne({where: {deployment_key: deploymentKey}})
  .then(function (dep) {
    if (_.isEmpty(dep)) {
      throw new Error('does not found deployment');
    }
    return models.DeploymentsVersions.findOne({where: {deployment_id: dep.id, app_version: appVersion}});
  })
  .then(function (deploymentsVersions) {
    var packageId = _.get(deploymentsVersions, 'current_package_id', 0);
    if (_.eq(packageId, 0) ) {
      return;
    }
    var downloadURL = common.getDownloadUrl();
    return models.Packages.findById(packageId)
    .then(function (packages) {
      if (packages && _.eq(packages.deployment_id, deploymentsVersions.deployment_id) ) {
        rs.downloadURL = `${downloadURL}/${_.get(packages, 'blob_url')}`;
        rs.description = _.get(packages, 'description', '');
        rs.isAvailable = true;
        rs.isMandatory = _.eq(deploymentsVersions.is_mandatory, 1) ? true : false;
        rs.appVersion = appVersion;
        rs.packageHash = _.get(packages, 'package_hash', '');
        rs.label = _.get(packages, 'label', '');
        rs.packageSize = _.get(packages, 'size', 0);
        rs.shouldRunBinaryVersion = false;
      }
      return packages;
    })
    .then(function (packages) {
      //差异化更新
      if (!_.isEmpty(packages) && !_.eq(_.get(packages, 'package_hash', ""), packageHash)) {
        return models.PackagesDiff.findOne({where: {package_id:packages.id, diff_against_package_hash: packageHash}})
        .then(function (diffPackage) {
          if (!_.isEmpty(diffPackage)) {
            rs.downloadURL = `${downloadURL}/${_.get(diffPackage, 'diff_blob_url')}`;
            rs.packageSize = _.get(diffPackage, 'diff_size', 0);
          }
          return;
        });
      } else {
        return;
      }
    });
  })
  .then(function () {
    return rs;
  });
};

proto.getPackagesInfo = function (deploymentKey, label) {
  if (_.isEmpty(deploymentKey) || _.isEmpty(label)) {
    return Promise.reject(new Error("please input deploymentKey and appVersion"))
  }
  return models.Deployments.findOne({where: {deployment_key: deploymentKey}})
  .then(function (dep) {
    if (_.isEmpty(dep)) {
      throw new Error('does not found deployment');
    }
    return models.Packages.findOne({where: {deployment_id: dep.id, label: label}});
  })
  .then(function (packages) {
    if (_.isEmpty(packages)) {
      throw new Error('does not found packages');
    }
    return packages;
  });
};

proto.reportStatusDownload = function(deploymentKey, label, clientUniqueId) {
  return this.getPackagesInfo(deploymentKey, label)
  .then(function (packages) {
    return models.PackagesMetrics.addOneOnDownloadById(packages.id);
  });
};

proto.reportStatusDeploy = function (deploymentKey, label, clientUniqueId, others) {
  return this.getPackagesInfo(deploymentKey, label)
  .then(function (packages) {
    var status =  _.get(others, "status");
    var packageId = packages.id;
    if (_.eq(status, "DeploymentSucceeded")) {
      return Promise.all([
        models.PackagesMetrics.addOneOnInstalledById(packageId),
        models.PackagesMetrics.addOneOnActiveById(packageId),
      ]);
    } else if (_.eq(status, "DeploymentFailed")) {
      return Promise.all([
        models.PackagesMetrics.addOneOnInstalledById(packageId),
        models.PackagesMetrics.addOneOnFailedById(packageId)
      ]);
    }else {
      return;
    }
  });
};

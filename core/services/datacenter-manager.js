'use strict';
var Q = require('q');
var Promise = Q.Promise;
var models = require('../../models');
var _ = require('lodash');
var fs = require('fs');
var os = require('os');
var security = require('../utils/security');
var common = require('../utils/common');
const MANIFEST_FILE_NAME = 'manifest.json';
const CONTENTS_NAME = 'contents';

var proto = module.exports = function (){
  function DataCenterManager() {

  }
  DataCenterManager.__proto__ = proto;
  return DataCenterManager;
};

proto.getDataDir = function () {
  var dataDir = _.get(require('../config'), 'common.dataDir', {});
  if (_.isEmpty(dataDir)) {
    dataDir = os.tmpdir();
  }
  return dataDir;
}

proto.hasPackageStoreSync = function (packageHash) {
  var dataDir = this.getDataDir();
  var packageHashPath = `${dataDir}/${packageHash}`;
  var manifestFile = `${packageHashPath}/${MANIFEST_FILE_NAME}`;
  var contentPath = `${packageHashPath}/${CONTENTS_NAME}`;
  return fs.existsSync(manifestFile) && fs.existsSync(contentPath);
}

proto.getPackageInfo = function (packageHash) {
  if (this.hasPackageStoreSync(packageHash)){
    var dataDir = this.getDataDir();
    var packageHashPath = `${dataDir}/${packageHash}`;
    var manifestFile = `${packageHashPath}/${MANIFEST_FILE_NAME}`;
    var contentPath = `${packageHashPath}/${CONTENTS_NAME}`;
    return this.buildPackageInfo(packageHash, packageHashPath, contentPath, manifestFile);
  } else {
    throw new Error('can\'t get PackageInfo');
  }
}

proto.buildPackageInfo = function (packageHash, packageHashPath, contentPath, manifestFile) {
  return {
    packageHash: packageHash,
    path: packageHashPath,
    contentPath: contentPath,
    manifestFilePath:manifestFile
  }
}

proto.validateStore = function (providePackageHash) {
  var dataDir = this.getDataDir();
  var packageHashPath = `${dataDir}/${providePackageHash}`;
  var manifestFile = `${packageHashPath}/${MANIFEST_FILE_NAME}`;
  var contentPath = `${packageHashPath}/${CONTENTS_NAME}`;
  if (!this.hasPackageStoreSync(providePackageHash)) {
    return Promise.resolve(false);
  }
  return security.calcAllFileSha256(contentPath)
  .then(function (manifestJson) {
    var packageHash = security.packageHashSync(manifestJson);
    try {
      var manifestJsonLocal = JSON.parse(fs.readFileSync(manifestFile));
    }catch(e) {
      return false;
    }
    var packageHashLocal = security.packageHashSync(manifestJsonLocal);
    if (_.eq(providePackageHash, packageHash) && _.eq(providePackageHash, packageHashLocal)) {
      return true;
    }
    return false;
  });
}

proto.storePackage = function (sourceDst, force) {
  if (_.isEmpty(force)){
    force = false;
  }
  var self = this;
  return security.calcAllFileSha256(sourceDst)
  .then(function (manifestJson) {
    var packageHash = security.packageHashSync(manifestJson);
    var dataDir = self.getDataDir();
    var packageHashPath = `${dataDir}/${packageHash}`;
    var manifestFile = `${packageHashPath}/${MANIFEST_FILE_NAME}`;
    var contentPath = `${packageHashPath}/${CONTENTS_NAME}`;
    if (!force && self.hasPackageStoreSync(packageHash)) {
      return self.buildPackageInfo(packageHash, packageHashPath, contentPath, manifestFile);
    } else {
      common.createEmptyFolderSync(packageHashPath);
      return common.move(sourceDst, contentPath)
      .then(function () {
        var manifestString = JSON.stringify(manifestJson);
        fs.writeFileSync(manifestFile, manifestString);
        return self.buildPackageInfo(packageHash, packageHashPath, contentPath, manifestFile);
      });
    }
  });
}

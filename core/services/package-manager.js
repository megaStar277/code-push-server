'use strict';
var Q = require('q');
var Promise = Q.Promise;
var models = require('../../models');
var security = require('../utils/security');
var _ = require('lodash');
var qetag = require('../utils/qetag');
var formidable = require('formidable');
var yazl = require("yazl");
var fs = require("fs");
var slash = require("slash");
var common = require('../utils/common');
var os = require('os');
var path = require('path');
var config    = _.get(require('../config'), 'qiniu', {});

var proto = module.exports = function (){
  function PackageManager() {

  }
  PackageManager.__proto__ = proto;
  return PackageManager;
};

proto.parseReqFile = function (req) {
  return Promise(function (resolve, reject, notify) {
    var form = new formidable.IncomingForm();
    form.parse(req, function(err, fields, files) {
      if (err) {
        reject({message: "upload error"});
      } else {
        if (_.isEmpty(fields.packageInfo) || _.isEmpty(files.package)) {
          reject({message: "upload info lack"});
        } else {
          resolve({packageInfo:JSON.parse(fields.packageInfo), package: files.package});
        }
      }
    });
  });
};

proto.getDeploymentsVersions = function (deploymentId, appVersion) {
  return models.DeploymentsVersions.findOne({
    where: {deployment_id: deploymentId, app_version: appVersion}
  });
};

proto.existPackageHash = function (deploymentId, appVersion, packageHash) {
  return this.getDeploymentsVersions(deploymentId, appVersion).then(function (data) {
    if (_.isEmpty(data)){
      return models.DeploymentsVersions.create({
        deployment_id: deploymentId,
        app_version: appVersion,
        is_mandatory: false,
      }).then(function () {
        return false;
      });
    } else {
      var packageId = data.current_package_id;
      if (_.gt(packageId, 0)) {
        return models.Packages.findOne({
          where: {id: packageId}
        }).then(function (data) {
          if (_.eq(_.get(data,"package_hash"), packageHash)){
            return true;
          }else {
            return false;
          }
        });
      }else {
        return false
      }
    }
  });
};

proto.createPackage = function (deploymentId, appVersion, packageHash, manifestHash, blobHash, params) {
  var releaseMethod = params.releaseMethod || 'Upload';
  var releaseUid = params.releaseUid || 0;
  var isMandatory = params.isMandatory ? 1 : 0;
  var size = params.size || 0;
  var description = params.description || "";
  var originalLabel = params.originalLabel || "";
  var originalDeployment = params.originalDeployment || "";
  return models.Deployments.generateLabelId(deploymentId).then(function (labelId) {
    return models.sequelize.transaction(function (t) {
      return models.Packages.create({
        deployment_id: deploymentId,
        description: description,
        package_hash: packageHash,
        blob_url: blobHash,
        size: size,
        manifest_blob_url: manifestHash,
        release_method: releaseMethod,
        label: "v" + labelId,
        released_by: releaseUid,
        original_label: originalLabel,
        original_deployment: originalDeployment
      },{transaction: t
      }).then(function (packages) {
        return models.DeploymentsVersions.findOne({where: {deployment_id: deploymentId, app_version: appVersion}})
        .then(function (deploymentsVersions) {
          if (_.isEmpty(deploymentsVersions)) {
            return models.DeploymentsVersions.create({
              is_mandatory: isMandatory,
              current_package_id: packages.id,
              deployment_id: deploymentId,
              app_version: appVersion
            },
            {transaction: t})
          } else {
            deploymentsVersions.set('is_mandatory', isMandatory);
            deploymentsVersions.set('current_package_id', packages.id);
            return deploymentsVersions.save({transaction: t});
          }
        }).then(function (deploymentsVersions) {
          return models.Deployments.update({
            last_deployment_version_id: deploymentsVersions.id
          },{where: {id: deploymentId}, transaction: t});
        }).then(function () {
          return packages;
        });
      });
    });
  });
};

proto.downloadPackageAndExtract = function (workDirectoryPath, packageHash, blobHash) {
  var dataCenterManager = require('./datacenter-manager')();
  return dataCenterManager.validateStore(packageHash)
  .then(function (isValidate) {
    if (isValidate) {
      return dataCenterManager.getPackageInfo(packageHash);
    } else {
      var downloadURL = _.get(config, 'downloadUrl') + '/' + blobHash;
      return common.createFileFromRequest(downloadURL, `${workDirectoryPath}/${blobHash}`)
      .then(function (download) {
        return common.unzipFile(`${workDirectoryPath}/${blobHash}`, `${workDirectoryPath}/current`)
        .then(function (outputPath) {
          return dataCenterManager.storePackage(outputPath, true);
        });
      });
    }
  });
}

proto.zipDiffPackage = function (fileName, files, baseDirectoryPath, hotCodePushFile) {
  return Promise(function (resolve, reject, notify) {
    var zipFile = new yazl.ZipFile();
    var writeStream = fs.createWriteStream(fileName);
    writeStream.on('error', function (error) {
      reject(error);
    })
    zipFile.outputStream.pipe(writeStream)
    .on("error", function (error) {
      reject(error);
    })
    .on("close", function () {
      resolve({ isTemporary: true, path: fileName });
    });
    for (var i = 0; i < files.length; ++i) {
        var file = files[i];
        zipFile.addFile(`${baseDirectoryPath}/${file}`, slash(file));
    }
    zipFile.addFile(hotCodePushFile, 'hotcodepush.json');
    zipFile.end();
  });
}

proto.generateOneDiffPackage = function (workDirectoryPath, packageId, dataCenter, diffPackageHash, diffManifestBlobHash) {
  var self = this;
  return models.PackagesDiff.findOne({
    where:{
      package_id: packageId,
      diff_against_package_hash: diffPackageHash
    }
  })
  .then(function (diffPackage) {
    if (!_.isEmpty(diffPackage)) {
      return;
    }
    var downloadURL = _.get(config, 'downloadUrl') + '/' + diffManifestBlobHash;
    return common.createFileFromRequest(downloadURL, `${workDirectoryPath}/${diffManifestBlobHash}`)
    .then(function(){
      var originContentPath = dataCenter.contentPath;
      var originManifestJson = JSON.parse(fs.readFileSync(dataCenter.manifestFilePath, "utf8"))
      var diffManifestJson = JSON.parse(fs.readFileSync(`${workDirectoryPath}/${diffManifestBlobHash}`, "utf8"))
      var json = common.diffCollectionsSync(originManifestJson, diffManifestJson);
      var files = _.concat(json.diff, json.collection1Only);
      var hotcodepush = {deletedFiles: json.collection2Only};
      var hotCodePushFile = `${workDirectoryPath}/${diffManifestBlobHash}_hotcodepush`;
      fs.writeFileSync(hotCodePushFile, JSON.stringify(hotcodepush));
      var fileName = `${workDirectoryPath}/${diffManifestBlobHash}.zip`;

      return self.zipDiffPackage(fileName, files, originContentPath, hotCodePushFile)
      .then(function (data) {
        return security.qetag(data.path)
        .then(function (diffHash) {
          return common.uploadFileToQiniu(diffHash, fileName)
          .then(function () {
              var stats = fs.statSync(fileName);
              return models.PackagesDiff.create({
                package_id: packageId,
                diff_against_package_hash: diffPackageHash,
                diff_blob_url: diffHash,
                diff_size: stats.size
              });
          })
        });
      });
    });
  });
}

proto.createDiffPackages = function (packageId, num) {
  var self = this;
  return models.Packages.findById(packageId).then(function (data) {
    if (_.isEmpty(data)) {
      throw Error('can\'t find Package');
    }
    return models.Packages.findAll({
      where:{
        deployment_id: data.deployment_id,
        id: {$lt: packageId}},
        order:[['id','desc']],
        limit:num
      })
    .then(function (lastNumsPackages) {
      if (_.isEmpty(lastNumsPackages)) {
        return null;
      }
      var package_hash = _.get(data, 'package_hash');
      var manifest_blob_url = _.get(data, 'manifest_blob_url');
      var blob_url = _.get(data, 'blob_url');
      var workDirectoryPath = path.join(os.tmpdir(), 'codepush_' + security.randToken(32));
      common.createEmptyFolderSync(workDirectoryPath);
      return self.downloadPackageAndExtract(workDirectoryPath, package_hash, blob_url)
      .then(function (dataCenter) {
        return Q.allSettled(
          _.map(lastNumsPackages, function (v) {
            return self.generateOneDiffPackage(workDirectoryPath, packageId, dataCenter, v.package_hash, v.manifest_blob_url);
          })
        );
      })
      .finally(function () {
        common.deleteFolderSync(workDirectoryPath);
      });
    })
  });
}

proto.releasePackage = function (deploymentId, packageInfo, fileType, filePath, releaseUid, pubType) {
  var self = this;
  var appVersion = packageInfo.appVersion;
  var description = packageInfo.description;
  var isMandatory = packageInfo.isMandatory;
  return security.qetag(filePath)
  .then(function (blobHash) {
    var directoryPath = path.join(os.tmpdir(), 'codepush_' + security.randToken(32));
    return common.createEmptyFolder(directoryPath)
    .then(function () {
      if (fileType == "application/zip") {
        return common.unzipFile(filePath, directoryPath)
      } else {
        throw new Error("file type error!");
      }
    })
    .then(function (directoryPath) {
      return security.isAndroidPackage(directoryPath)
      .then(function (isAndroid) {
        if (pubType == 'android' ) {
          if (!isAndroid){
            throw new Error("it must be publish it by android type");
          }
        } else if (pubType == 'ios') {
          if (isAndroid){
            throw new Error("it must be publish it by ios type");
          }
        }else {
          throw new Error(`${pubType} does not support.`);
        }
        var dataCenterManager = require('./datacenter-manager')();
        return dataCenterManager.storePackage(directoryPath)
        .then(function (dataCenter) {
          var packageHash = dataCenter.packageHash;
          var manifestFile = dataCenter.manifestFilePath;
          return self.existPackageHash(deploymentId, appVersion, packageHash)
          .then(function (isExist) {
            if (isExist){
              throw new Error("The uploaded package is identical to the contents of the specified deployment's current release.");
            }
          })
          .then(function () {
            return security.qetag(manifestFile).then(function (manifestHash) {
              return Q.allSettled([
                common.uploadFileToQiniu(manifestHash, manifestFile),
                common.uploadFileToQiniu(blobHash, filePath)
              ]).spread(function (up1, up2) {
                return [packageHash, manifestHash, blobHash];
              });
            });
          });
        });
      });

    }).spread(function (packageHash, manifestHash, blobHash) {
      var stats = fs.statSync(filePath);
      var params = {
        releaseMethod: 'Upload',
        releaseUid: releaseUid,
        isMandatory: isMandatory,
        size: stats.size,
        description: description
      }
      return self.createPackage(deploymentId, appVersion, packageHash, manifestHash, blobHash, params);
    }).finally(function () {
      common.deleteFolderSync(directoryPath);
    });
  });
};

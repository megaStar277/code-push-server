'use strict';
var Promise = require('bluebird');
var fs = require("fs");
var fsextra = require("fs-extra");
var extract = require('extract-zip')
var config    = require('../config');
var _ = require('lodash');
var qiniu = require("qiniu");
var common = {};
var AppError = require('../app-error');
var log4js = require('log4js');
var log = log4js.getLogger("cps:utils:common");
module.exports = common;

common.createFileFromRequest = function (url, filePath) {
  return new Promise((resolve, reject) => {
    fs.exists(filePath, function (exists) {
      if (!exists) {
        var request = require('request');
        request(url).on('error', function (error) {
          reject(error);
        })
        .on('response', function (response) {
          if (response.statusCode == 200) {
            let stream = fs.createWriteStream(filePath);
            response.pipe(stream);
            stream.on('close',function(){
              resolve(null);
            });
            stream.on('error', function (error) {
              reject(error)
            })
          } else {
            reject({message:'request fail'})
          }
        });
      }else {
        resolve(null);
      }
    });
  });
}

common.move = function (sourceDst, targertDst) {
  return new Promise((resolve, reject) => {
    fsextra.move(sourceDst, targertDst, {clobber: true, limit: 16}, function (err) {
      if (err) {
        log.error(err);
        reject(err);
      } else {
        log.debug(`move success sourceDst:${sourceDst} targertDst:${targertDst}`);
        resolve();
      }
    });
  });
};

common.deleteFolder = function (folderPath) {
  return new Promise((resolve, reject) => {
    fsextra.remove(folderPath, function (err) {
      if (err) {
        log.error(err);
        reject(err);
      }else {
        log.debug(`deleteFolder delete ${folderPath} success.`);
        resolve(null);
      }
    });
  });
};

common.deleteFolderSync = function (folderPath) {
  return fsextra.removeSync(folderPath);
};

common.createEmptyFolder = function (folderPath) {
  return new Promise((resolve, reject) => {
    log.debug(`createEmptyFolder Create dir ${folderPath}`);
    return common.deleteFolder(folderPath)
    .then((data) => {
      fsextra.mkdirs(folderPath, (err) => {
        if (err) {
          log.error(err);
          reject(new AppError.AppError(err.message));
        } else {
          resolve(folderPath);
        }
      });
    });
  });
};

common.createEmptyFolderSync = function (folderPath) {
  common.deleteFolderSync(folderPath);
  return fsextra.mkdirsSync(folderPath);
};

common.unzipFile = function (zipFile, outputPath) {
  return new Promise((resolve, reject) => {
    try {
      log.debug(`unzipFile check zipFile ${zipFile} fs.R_OK`);
      fs.accessSync(zipFile, fs.R_OK);
      log.debug(`Pass unzipFile file ${zipFile}`);
    } catch (e) {
      log.error(e);
      return reject(new AppError.AppError(e.message))
    }
    extract(zipFile, {dir: outputPath}, function(err){
      if (err) {
        log.error(err);
        reject(new AppError.AppError(`it's not a zipFile`))
      } else {
        log.debug(`unzipFile success`);
        resolve(outputPath);
      }
    });
  });
};

common.uptoken = function (bucket, key) {
  var putPolicy = new qiniu.rs.PutPolicy(bucket+":"+key);
  return putPolicy.token();
};

common.uploadFileToStorage = function (key, filePath) {
  if (_.get(config, 'common.storageType') === 'local') {
    return common.uploadFileToLocal(key, filePath);
  } else if (_.get(config, 'common.storageType') === 's3') {
    return common.uploadFileToS3(key, filePath);
  } else if (_.get(config, 'common.storageType') === 'oss') {
    return common.uploadFileToOSS(key, filePath);
  }
  return common.uploadFileToQiniu(key, filePath);
};

common.uploadFileToLocal = function (key, filePath) {
  return new Promise((resolve, reject) => {
    var storageDir = _.get(config, 'local.storageDir');
    if (!storageDir) {
      throw new AppError.AppError('please set config local storageDir');
    }
    try {
      log.debug(`uploadFileToLocal check directory ${storageDir} fs.R_OK`);
      fs.accessSync(storageDir, fs.W_OK);
      log.debug(`uploadFileToLocal directory ${storageDir} fs.R_OK is ok`);
    } catch (e) {
      log.error(e);
      throw new AppError.AppError(e.message);
    }
    if (fs.existsSync(`${storageDir}/${key}`)) {
      return resolve(key);
    }
    var stats = fs.statSync(storageDir);
    if (!stats.isDirectory()) {
      var e = new AppError.AppError(`${storageDir} must be directory`);
      log.error(e);
      throw e;
    }
    try {
     fs.accessSync(filePath, fs.R_OK);
    } catch (e) {
      log.error(e);
      throw new AppError.AppError(e.message);
    }
    stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      var e = new AppError.AppError(`${filePath} must be file`);
      log.debug(e);
      throw e;
    }
    fsextra.copy(filePath, `${storageDir}/${key}`,(err) => {
      if (err) {
        log.error(new AppError.AppError(err.message));
        return reject(new AppError.AppError(err.message));
      }
      log.debug(`uploadFileToLocal copy file ${key} success.`);
      resolve(key);
    });
  });
};

common.getDownloadUrl = function () {
  if (_.get(config, 'common.storageType') === 'local') {
    return _.get(config, 'local.downloadUrl');
  } else if (_.get(config, 'common.storageType') === 's3') {
    return _.get(config, 's3.downloadUrl');
  } else if (_.get(config, 'common.storageType') === 'oss') {
    return _.get(config, 'oss.downloadUrl');
  }
  return _.get(config, 'qiniu.downloadUrl');
}

common.getBlobDownloadUrl = function (blobUrl) {
  return `${common.getDownloadUrl()}/${blobUrl}`
};

common.uploadFileToQiniu = function (key, filePath) {
  return new Promise((resolve, reject) => {
    qiniu.conf.ACCESS_KEY = _.get(config, "qiniu.accessKey");
    qiniu.conf.SECRET_KEY = _.get(config, "qiniu.secretKey");
    var bucket = _.get(config, "qiniu.bucketName", "jukang");
    var client = new qiniu.rs.Client();
    client.stat(bucket, key, (err, ret) => {
      if (!err) {
        resolve(ret.hash);
      } else {
        try {
          var uptoken = common.uptoken(bucket, key);
        } catch (e) {
          return reject(e);
        }
        var extra = new qiniu.io.PutExtra();
        qiniu.io.putFile(uptoken, key, filePath, extra, (err, ret) => {
          if(!err) {
            // 上传成功， 处理返回值
            resolve(ret.hash);
          } else {
            // 上传失败， 处理返回代码
            reject(new AppError.AppError(JSON.stringify(err)));
          }
        });
      }
    });
  });
};

common.uploadFileToS3 = function (key, filePath) {
  var AWS = require('aws-sdk');
  return (
    new Promise((resolve, reject) => {
      AWS.config.update({
        region: _.get(config, 's3.region')
      });
      var s3 = new AWS.S3({
        params: {Bucket: _.get(config, 's3.bucketName')}
      });
      fs.readFile(filePath, (err, data) => {
        s3.upload({
          Key: key,
          Body: data,
          ACL:'public-read',
        }, (err, response) => {
          if(err) {
            reject(new AppError.AppError(JSON.stringify(err)));
          } else {
            resolve(response.ETag)
          }
        })
      });
    })
  );
};

common.uploadFileToOSS = function (key, filePath) {
  var ALY = require('aliyun-sdk');
  var ossStream = require('aliyun-oss-upload-stream')(new ALY.OSS({
    accessKeyId:  _.get(config, 'oss.accessKeyId'),
    secretAccessKey: _.get(config, 'oss.secretAccessKey'),
    endpoint: _.get(config, 'oss.endpoint'),
    apiVersion: '2013-10-15',
  }));
  if (!_.isEmpty(_.get(config, 'oss.prefix', ""))) {
    key = `${_.get(config, 'oss.prefix')}/${key}`;
  }
  var upload = ossStream.upload({
    Bucket: _.get(config, 'oss.bucketName'),
    Key: key,
  });

  return new Promise((resolve, reject) => {
    upload.on('error', (error) => {
      reject(error);
    });

    upload.on('uploaded', (details) => {
      resolve(details.ETag);
    });
    fs.createReadStream(filePath).pipe(upload);
  });
};

common.diffCollectionsSync = function (collection1, collection2) {
  var diffFiles = [];
  var collection1Only = [];
  var newCollection2 = Object.assign({}, collection2);
  if (collection1 instanceof Object) {
    for(var key of Object.keys(collection1)) {
      if (_.isEmpty(newCollection2[key])) {
        collection1Only.push(key);
      } else {
        if (!_.eq(collection1[key], newCollection2[key])) {
          diffFiles.push(key);
        }
        delete newCollection2[key];
      }
    }
  }
  return {diff:diffFiles, collection1Only: collection1Only, collection2Only: Object.keys(newCollection2)}
};

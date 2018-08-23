'use strict';
var Promise = require('bluebird');
var fs = require("fs");
var fsextra = require("fs-extra");
var extract = require('extract-zip')
var config    = require('../config');
var _ = require('lodash');
var validator = require('validator');
var qiniu = require("qiniu");
var common = {};
var AppError = require('../app-error');
var log4js = require('log4js');
var log = log4js.getLogger("cps:utils:common");
module.exports = common;

common.parseVersion = function (versionNo) {
  var version = '0';
  var data = null;
  if (data = versionNo.match(/^([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/)) {
    // "1.2.3"
    version = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
  } else if (data = versionNo.match(/^([0-9]{1,3}).([0-9]{1,5})$/)) {
    // "1.2"
    version = data[1] + _.padStart(data[2], 5, '0') + _.padStart('0', 10, '0');
  }
  return version;
};

common.validatorVersion = function (versionNo) {
  var flag = false;
  var min = '0';
  var max = '9999999999999999999';
  var data = null;
  if (versionNo == "*") {
    // "*"
    flag = true;
  } else if (data = versionNo.match(/^([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/)) {
    // "1.2.3"
    flag = true;
    min = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
    max = data[1] + _.padStart(data[2], 5, '0') + _.padStart((parseInt(data[3])+1), 10, '0');
  } else if (data = versionNo.match(/^([0-9]{1,3}).([0-9]{1,5})(\.\*){0,1}$/)) {
    // "1.2" "1.2.*"
    flag = true;
    min = data[1] + _.padStart(data[2], 5, '0') + _.padStart('0', 10, '0');
    max = data[1] + _.padStart((parseInt(data[2])+1), 5, '0') + _.padStart('0', 10, '0');
  } else if (data = versionNo.match(/^\~([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/)) {
    //"~1.2.3"
    flag = true;
    min = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
    max = data[1] + _.padStart((parseInt(data[2])+1), 5, '0') + _.padStart('0', 10, '0');
  } else if (data = versionNo.match(/^\^([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/)) {
    //"^1.2.3"
    flag = true;
    min = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
    max = _.toString((parseInt(data[1])+1)) + _.padStart(0, 5, '0') + _.padStart('0', 10, '0');
  } else if (data = versionNo.match(/^([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})-([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/)) {
    // "1.2.3-1.2.7"
    flag = true;
    min = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
    max = data[4] + _.padStart(data[5], 5, '0') + _.padStart((parseInt(data[6])+1), 10, '0');
  } else if (data = versionNo.match(/^>=([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})<([0-9]{1,3}).([0-9]{1,5}).([0-9]{1,10})$/)) {
    //">=1.2.3<1.2.7"
    flag = true;
    min = data[1] + _.padStart(data[2], 5, '0') + _.padStart(data[3], 10, '0');
    max = data[4] + _.padStart(data[5], 5, '0') + _.padStart(data[6], 10, '0');
  }
  return [flag, min, max];
};

common.createFileFromRequest = function (url, filePath) {
  return new Promise((resolve, reject) => {
    fs.exists(filePath, function (exists) {
      if (!exists) {
        var request = require('request');
        log.debug(`createFileFromRequest url:${url}`)
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
};

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

common.getUploadTokenQiniu = function (mac, bucket, key) {
  var options = {
    scope: bucket + ":" + key
  }
  var putPolicy = new qiniu.rs.PutPolicy(options);
  return putPolicy.uploadToken(mac);
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
    if (key.length < 3) {
      log.error(`generate key is too short, key value:${key}`);
      throw new AppError.AppError('generate key is too short.');
    }
    try {
      log.debug(`uploadFileToLocal check directory ${storageDir} fs.R_OK`);
      fs.accessSync(storageDir, fs.W_OK);
      log.debug(`uploadFileToLocal directory ${storageDir} fs.R_OK is ok`);
    } catch (e) {
      log.error(e);
      throw new AppError.AppError(e.message);
    }
    var subDir = key.substr(0, 2).toLowerCase();
    var finalDir = `${storageDir}/${subDir}`;
    var fileName = `${finalDir}/${key}`;
    if (fs.existsSync(fileName)) {
      return resolve(key);
    }
    var stats = fs.statSync(storageDir);
    if (!stats.isDirectory()) {
      var e = new AppError.AppError(`${storageDir} must be directory`);
      log.error(e);
      throw e;
    }
    if (!fs.existsSync(`${finalDir}`)) {
      fs.mkdirSync(`${finalDir}`);
      log.debug(`uploadFileToLocal mkdir:${finalDir}`);
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
      log.error(e);
      throw e;
    }
    fsextra.copy(filePath, fileName,(err) => {
      if (err) {
        log.error(new AppError.AppError(err.message));
        return reject(new AppError.AppError(err.message));
      }
      log.debug(`uploadFileToLocal copy file ${key} success.`);
      resolve(key);
    });
  });
};

common.getBlobDownloadUrl = function (blobUrl) {
  var fileName = blobUrl;
  var storageType = _.get(config, 'common.storageType');
  var downloadUrl = _.get(config, `${storageType}.downloadUrl`);
  if ( storageType === 'local') {
    fileName = blobUrl.substr(0, 2).toLowerCase() + '/' + blobUrl;
  }
  if (!validator.isURL(downloadUrl)) {
    var e = new AppError.AppError(`Please config ${storageType}.downloadUrl in config.js`);
    log.error(e);
    throw e;
  }
  return `${downloadUrl}/${fileName}`
};


common.uploadFileToQiniu = function (key, filePath) {
  return new Promise((resolve, reject) => {
    var accessKey = _.get(config, "qiniu.accessKey");
    var secretKey = _.get(config, "qiniu.secretKey");
    var bucket = _.get(config, "qiniu.bucketName", "");
    var mac = new qiniu.auth.digest.Mac(accessKey, secretKey);
    var conf = new qiniu.conf.Config();
    var bucketManager = new qiniu.rs.BucketManager(mac, conf);
    bucketManager.stat(bucket, key, (respErr, respBody, respInfo) => {
      if (respErr) {
        log.debug('uploadFileToQiniu file stat:', respErr);
        return reject(new AppError.AppError(respErr.message));
      }
      log.debug('uploadFileToQiniu file stat respBody:', respBody);
      log.debug('uploadFileToQiniu file stat respInfo:', respInfo);
      if (respInfo.statusCode == 200) {
        resolve(respBody.hash);
      } else {
        try {
          var uploadToken = common.getUploadTokenQiniu(mac, bucket, key);
        } catch (e) {
          return reject(new AppError.AppError(e.message));
        }
        var formUploader = new qiniu.form_up.FormUploader(conf);
        var putExtra = new qiniu.form_up.PutExtra();
        formUploader.putFile(uploadToken, key, filePath, putExtra, (respErr, respBody, respInfo) => {
          if(respErr) {
            log.error('uploadFileToQiniu putFile:', respErr);
            // 上传失败， 处理返回代码
            return reject(new AppError.AppError(JSON.stringify(respErr)));
          } else {
            log.debug('uploadFileToQiniu putFile respBody:', respBody);
            log.debug('uploadFileToQiniu putFile respInfo:', respInfo);
            // 上传成功， 处理返回值
            if (respInfo.statusCode == 200) {
              return resolve(respBody.hash);
            } else {
              return reject(new AppError.AppError(respBody.error));
            }
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
        accessKeyId: _.get(config, 's3.accessKeyId'),
        secretAccessKey: _.get(config, 's3.secretAccessKey'),
        sessionToken: _.get(config, 's3.sessionToken'),
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

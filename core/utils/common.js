'use strict';
var Q = require('q');
var Promise = Q.Promise;
var fs = require("fs");
var fsextra = require("fs.extra");
var unzip = require('node-unzip-2');
var qiniu = require("qiniu");
var _ = require('lodash');
var config    = _.get(require('../config'), 'qiniu', {});
var common = {};
module.exports = common;

common.createFileFromRequest = function (url, filePath) {
  return Promise(function (resolve, reject, notify) {
    fs.exists(filePath, function (exists) {
      if (!exists) {
        var request = require('request');
        request(url).on('error', function (error) {
          reject(error);
        }).on('response', function (response) {
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
  return Promise(function (resolve, reject, notify) {
    var ncp = require('ncp').ncp;
    ncp.limit = 16;
    ncp.clobber = true;
    ncp(sourceDst, targertDst, function (err) {
      if (err) {
        return reject(err);
      }
      resolve();
      common.deleteFolder(sourceDst);
    });
  });
};

common.deleteFolder = function (folderPath) {
  return Promise(function (resolve, reject, notify) {
    fsextra.rmrf(folderPath, function (err) {
      if (err) {
        reject(err);
      }else {
        resolve(null);
      }
    });
  });
};

common.deleteFolderSync = function (folderPath) {
  return fsextra.rmrfSync(folderPath);
};

common.createEmptyFolder = function (folderPath) {
  return Promise(function (resolve, reject, notify) {
    common.deleteFolder(folderPath).then(function (data) {
      fsextra.mkdirp(folderPath, function (err) {
        if (err) {
          reject({message: "create error"});
        } else {
          resolve(folderPath);
        }
      });
    });
  });
};

common.createEmptyFolderSync = function (folderPath) {
  common.deleteFolderSync(folderPath);
  return fsextra.mkdirp(folderPath);
};

common.unzipFile = function (zipFile, outputPath) {
  return Promise(function (resolve, reject, notify) {
    try {
      fs.exists(zipFile, function(exists){
        if (!exists) {
          reject({message: 'zipfile not found!'})
        }
        var readStream = fs.createReadStream(zipFile);
        var extract = unzip.Extract({ path: outputPath });
        readStream.pipe(extract);
        extract.on("close", function () {
          resolve(outputPath);
        });
      })
    } catch (e) {
      reject({message: 'zipfile not found!'})
    }
  });
};

common.uptoken = function (bucket, key) {
  var putPolicy = new qiniu.rs.PutPolicy(bucket+":"+key);
  return putPolicy.token();
}

common.uploadFileToQiniu = function (key, filePath) {
  return Promise(function (resolve, reject, notify) {
    try {
      qiniu.conf.ACCESS_KEY = _.get(config, "accessKey");
      qiniu.conf.SECRET_KEY = _.get(config, "secretKey");
      var bucket = _.get(config, "bucketName", "jukang");
      var client = new qiniu.rs.Client();
      client.stat(bucket, key, function(err, ret) {
        if (!err) {
          resolve(ret.hash);
        } else {
          var uptoken = common.uptoken(bucket, key);
          var extra = new qiniu.io.PutExtra();
          qiniu.io.putFile(uptoken, key, filePath, extra, function(err, ret) {
            if(!err) {
              // 上传成功， 处理返回值
              resolve(ret.hash);
            } else {
              // 上传失败， 处理返回代码
              reject({message: JSON.stringify(err)});
            }
          });
        }
      });
    } catch(e) {
      reject(e)
    }
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

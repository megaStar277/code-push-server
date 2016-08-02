'use strict';
var bcrypt = require('bcrypt');
var crypto = require('crypto');
var fs = require('fs');
var Q = require('q');
var Promise = Q.Promise;
var qetag = require('../utils/qetag');
var _ = require('lodash');

var randToken = require('rand-token').generator({
  chars: '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ',
  source: crypto.randomBytes
});
var security = {};
module.exports = security;

security.passwordHashSync = function(password){
  return bcrypt.hashSync(password, bcrypt.genSaltSync(12));
}

security.passwordVerifySync = function(password, hash){
  return bcrypt.compareSync(password, hash)
}

security.randToken = function(num) {
  return randToken.generate(num);
}

security.parseToken = function(token) {
  return {identical: token.substr(-9,9), token:token.substr(0,28)}
}

security.fileSha256 = function (file) {
  return Promise(function (resolve, reject, notify) {
    var rs = fs.createReadStream(file);
    var hash = crypto.createHash('sha256');
    rs.on('data', hash.update.bind(hash));
    rs.on('end', function () {
      resolve(hash.digest('hex'));
    });
  });
}

security.stringSha256Sync = function (contents) {
  var sha256 = crypto.createHash('sha256');
  sha256.update(contents);
  return sha256.digest('hex');
}

security.packageHashSync = function (jsonData) {
  var sortedArr = security.sortJsonToArr(jsonData);
  var manifestData = _.map(sortedArr, function(v){
    return v.path + ':' + v.hash;
  });
  var manifestString = JSON.stringify(manifestData.sort());
  manifestString = _.replace(manifestString, /\\\//g, '/');
  return security.stringSha256Sync(manifestString);
}

//参数为buffer或者readableStream或者文件路径
security.qetag = function (buffer) {
  return Promise(function (resolve, reject, notify) {
    qetag(buffer, resolve);
  });
}

security.qetagString = function (contents) {
  return Promise(function (resolve, reject, notify) {
    var Readable = require('stream').Readable
    var buffer = new Readable
    buffer.push(contents)
    buffer.push(null)
    qetag(buffer, resolve);
  });
}

security.sha256AllFiles = function (files) {
  return Promise(function (resolve, reject, notify) {
    var results = {};
    var length = files.length;
    var count = 0;
    files.forEach(function (file) {
      security.fileSha256(file)
      .then(function (hash) {
        results[file] = hash;
        count++;
        if (count == length) {
          resolve(results);
        }
      });
    });
  });
}

security.isAndroidPackage = function (directoryPath) {
  return Promise(function (resolve, reject, notify) {
    var recursiveFs = require("recursive-fs");
    var path = require('path');
    var slash = require("slash");
    recursiveFs.readdirr(directoryPath, function (error, directories, files) {
      if (error) {
        reject(error);
      } else {
        if (files.length == 0) {
          reject({message: "empty files"});
        }else {
          const AREGEX=/android\.bundle/
          var isAndroid = false;
          _.forIn(files, function (value) {
            if (AREGEX.test(value)) {
              isAndroid = true;
            }
          });
          resolve(isAndroid);
        }
      }
    });
  });
}

security.calcAllFileSha256 = function (directoryPath) {
  return Promise(function (resolve, reject, notify) {
    var recursiveFs = require("recursive-fs");
    var path = require('path');
    var slash = require("slash");
    recursiveFs.readdirr(directoryPath, function (error, directories, files) {
      if (error) {
        reject(error);
      } else {
        if (files.length == 0) {
          reject({message: "empty files"});
        }else {
          security.sha256AllFiles(files)
          .then(function (results) {
            var data = {};
            _.forIn(results, function (value, key) {
              var relativePath = path.relative(directoryPath, key);
              relativePath = slash(relativePath);
              data[relativePath] = value;
            });
            resolve(data);
          });
        }
      }
    });
  });
}

security.sortJsonToArr = function (json) {
  var rs = [];
  _.forIn(json, function (value, key) {
    rs.push({path:key, hash: value})
  });
  return _.sortBy(rs, function(o) { return o.path; });
}

'use strict';
var _ = require('lodash');
var Promise = require('bluebird');
var security = require('../core/utils/security');
var models = require('../models');
var moment = require('moment');

var middleware = module.exports

var checkAuthToken = function (authToken) {
  var objToken = security.parseToken(authToken);
  return models.Users.findOne({
    where: {identical: objToken.identical}
  })
  .then(function(users) {
    if (_.isEmpty(users)) {
      throw new Error('401 Unauthorized');
    }
    return models.UserTokens.findOne({
      where: {tokens: authToken, uid: users.id, expires_at: { gt: moment().format('YYYY-MM-DD HH:mm:ss') }}
    })
    .then(function(tokenInfo){
      if (_.isEmpty(tokenInfo)){
        throw new Error('401 Unauthorized')
      }
      return users;
    })
  }).then(function (users) {
    return users;
  })
}

var checkAccessToken = function (accessToken) {
  return new Promise(function (resolve, reject) {
    if (_.isEmpty(accessToken)) {
      throw new Error('401 Unauthorized');
    }
    var config = require('../core/config');
    var loginSecret = _.get(config, 'common.loginSecret');
    var jwt = require('jsonwebtoken');
    var authData = jwt.verify(accessToken, loginSecret);
    var uid = _.get(authData, 'uid', null);
    var hash = _.get(authData, 'hash', null);
    if (parseInt(uid) > 0) {
      return models.Users.findOne({
        where: {id: uid}
      })
      .then(function(users) {
        if (_.isEmpty(users)) {
          throw new Error('401 Unauthorized');
        }
        if (!_.eq(hash, security.md5(users.get('ack_code')))){
          throw new Error('401 Unauthorized');
        }
        resolve(users);
      })
      .catch(function (e) {
        reject(e);
      });
    } else {
      throw new Error('401 Unauthorized');
    }
  });
}

middleware.checkToken = function(req, res, next) {
  var authArr = _.split(req.get('Authorization'), ' ');
  var authType = 1;
  var authToken = null;
  if (_.eq(authArr[0], 'Bearer')) {
    authType = 1;
    authToken = authArr[1]; //Bearer
  } else if(_.eq(authArr[0], 'Basic')) {
    authType = 2;
    var b = new Buffer(authArr[1], 'base64');
    var user = _.split(b.toString(), ':');
    authToken = _.get(user, '1');
  } else {
    authType = 2;
    authToken = _.trim(_.trimStart(_.get(req, 'query.access_token', null)));
  }
  if (authType == 1) {
    checkAuthToken(authToken)
    .then(function(users) {
      req.users = users;
      next();
      return users;
    })
    .catch(function (e) {
      res.status(401).send(e.message);
    });
  } else if (authType == 2) {
    checkAccessToken(authToken)
    .then(function(users) {
      req.users = users;
      next();
      return users;
    })
    .catch(function (e) {
      res.status(401).send(e.message);
    });
  } else {
    res.status(401).send('401 Unauthorized');
  }
};

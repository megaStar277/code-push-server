'use strict';
var _ = require('lodash');
var Promise = require('bluebird');
var security = require('../core/utils/security');
var models = require('../models');

var middleware = module.exports

var checkAuthToken = function (authToken) {
  var objToken = security.parseToken(authToken);
  return models.Users.findOne({
    where: {identical: objToken.identical}
  }).then(function(users) {
    if (_.isEmpty(users)) {
      throw new Error('401 Unauthorized');
    }
    return models.UserTokens.findOne({
      where: {tokens: authToken, uid: users.id}
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
    if (parseInt(uid) > 0) {
      return models.Users.findOne({
        where: {id: uid}
      })
      .then(function(users) {
        if (_.isEmpty(users)) {
          throw new Error('401 Unauthorized');
        }
        resolve(users);
      });
    } else {
      throw new Error('401 Unauthorized');
    }
  });
}

middleware.checkToken = function(req, res, next) {
  var authToken = _.trim(_.trimStart(req.get('Authorization'), "Bearer"));
  var authStr = _.trim(_.trimStart(_.get(req, 'query.access_token', null)));
  if (!_.isEmpty(authToken) && authToken.length == 37) {
    checkAuthToken(authToken)
    .then(function(users) {
      req.users = users;
      next();
      return users;
    })
    .catch(function (e) {
      res.status(401).send(e.message);
    });
  } else if (!_.isEmpty(authStr)) {
    checkAccessToken(authStr)
    .then(function(users) {
      req.users = users;
      next();
      return users;
    })
    .catch(function (e) {
      res.status(401).send(e.message);
    });
  } else {
    res.status(401).send(e.message);
  }
};

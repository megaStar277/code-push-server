'use strict';
var Q = require('q');
var Promise = Q.Promise;
var models = require('../../models');
var _ = require('lodash');
var validator = require('validator');
var security = require('../utils/security');

var proto = module.exports = function (){
  function AccountManager() {

  }
  AccountManager.__proto__ = proto;
  return AccountManager;
};

proto.collaboratorCan = function(uid, appName) {
  return this.getCollaborator(uid, appName)
  .then(function (data) {
    if (!data) {
      throw new Error("Permission Deny!");
    }
    return data;
  });
};

proto.ownerCan = function(uid, appName) {
  return this.getCollaborator(uid, appName)
  .then(function (data) {
    if (!data || !_.eq(_.get(data,'roles'), 'Owner') ) {
      throw new Error("Permission Deny!");
    }
    return data;
  });
};

proto.getCollaborator = function (uid, appName) {
  return models.Collaborators.findByAppNameAndUid(uid, appName);
};

proto.findUserByEmail = function (email) {
  return models.Users.findOne({where: {email: email}})
  .then(function (data) {
    if (_.isEmpty(data)) {
      throw new Error(email + " does not exist.");
    } else {
      return data;
    }
  });
};

proto.getAllAccessKeyByUid = function (uid) {
  return models.UserTokens.findAll({where: {uid: uid}})
  .then(function (token) {
    return _.map(token, function(v){
      return {
        name: v.tokens,
        createdTime: v.created_at,
        createdBy: v.created_by,
        description: v.description,
      };
    });
  });
};

proto.createAccessKey = function (uid, newAccessKey,  createdBy, description) {
  return models.UserTokens.create({
    uid: uid,
    tokens: newAccessKey,
    description: description,
    created_by: createdBy
  });
};

proto.login = function (account, password) {
  if (_.isEmpty(account)) {
    return Promise.reject(new Error("Please input Account."))
  }
  if (_.isEmpty(password)) {
    return Promise.reject(new Error("Please input Password."))
  }
  var where = {};
  if (validator.isEmail(account)) {
    where = {email: account};
  }else {
    where = {username: account};
  }
  return models.Users.findOne({where: where})
  .then(function(users) {
    if (_.isEmpty(users)) {
      throw new Error("Account or Password ERROR.");
    } else {
      if (!security.passwordVerifySync(password, users.password)) {
        throw new Error("Account or Password ERROR.");
      }else {
        return users;
      }
    }
  });
};

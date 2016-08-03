'use strict';
var Promise = require('bluebird');
var models = require('../../models');
var _ = require('lodash');
var validator = require('validator');
var security = require('../utils/security');
var moment = require('moment');

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
  .then(function (tokens) {
    return _.map(tokens, function(v){
      return {
        id: v.id + "",
        name: '(hidden)',
        createdTime: parseInt(moment(v.created_at).format('x')),
        createdBy: v.created_by,
        expires: parseInt(moment(v.expires_at).format('x')),
        friendlyName: v.name,
        isSession: v.is_session == 0 ? false : true,
        description: v.description,
      };
    });
  });
};

proto.isExsitAccessKeyName = function (uid, friendlyName) {
  return models.UserTokens.findOne({
    where: {uid: uid, name: friendlyName}
  });
};

proto.createAccessKey = function (uid, newAccessKey, isSession, ttl, friendlyName, createdBy, description) {
  return models.UserTokens.create({
    uid: uid,
    name: friendlyName,
    tokens: newAccessKey,
    description: description,
    is_session: isSession ? true : false,
    created_by: createdBy,
    expires_at: moment().utc().add(ttl/1000, 'seconds').format('YYYY-MM-DD hh:mm:ss'),
    created_at: moment().utc().format('YYYY-MM-DD hh:mm:ss'),
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

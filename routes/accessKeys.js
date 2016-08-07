var express = require('express');
var router = express.Router();
var _ = require('lodash');
var security = require('../core/utils/security');
var models = require('../models');
var middleware = require('../core/middleware');
var accountManager = require('../core/services/account-manager')();

router.get('/', middleware.checkToken, function(req, res, next) {
  var uid = req.users.id;
  accountManager.getAllAccessKeyByUid(uid)
  .then(function(accessKeys){
    res.send({accessKeys:accessKeys});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.post('/', middleware.checkToken, function(req, res, next) {
  var uid = req.users.id;
  var identical = req.users.identical;
  var createdBy = _.trim(req.body.createdBy);
  var friendlyName = _.trim(req.body.friendlyName);
  var isSession = req.body.isSession;
  var ttl = parseInt(req.body.ttl);
  var description = _.trim(req.body.description);
  var newAccessKey = security.randToken(28).concat(identical);
  accountManager.isExsitAccessKeyName(uid, friendlyName)
  .then(function (data) {
    if (!_.isEmpty(data)) {
      throw Error(`The access key "${friendlyName}"  already exists.`);
    }
    return accountManager.createAccessKey(uid, newAccessKey, isSession, ttl, friendlyName, createdBy, description);
  })
  .then(function(newToken){
    var moment = require("moment");
    var info = {
      name : newToken.tokens,
      createdTime : parseInt(moment(newToken.created_at).format('x')),
      createdBy : newToken.created_by,
      expires : parseInt(moment(newToken.expires_at).format('x')),
      description : newToken.description,
      friendlyName: newToken.name,
    };
    res.send({accessKey:info});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.delete('/:name', middleware.checkToken, function(req, res, next){
  var name = _.trim(decodeURI(req.params.name));
  var uid = req.users.id;
  models.UserTokens.destroy({where: {name:name, uid: uid}})
  .then(function(rowNum){
    res.send({friendlyName:name});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.patch('/:name', middleware.checkToken, function(req, res, next){
  var name = _.trim(decodeURI(req.params.name));
  var friendlyName = _.trim(req.body.friendlyName);
  var ttl = _.trim(req.body.ttl);
  var uid = req.users.id;

  models.UserTokens.findOne({where: {name:name, uid: uid}})
  .then(function(token){
    if (_.isEmpty(token)) {
      throw new Error(`The access key "${name}" does not exist.`);
    }
    return accountManager.isExsitAccessKeyName(uid, friendlyName)
    .then(function (data) {
      if (!_.isEmpty(data)) {
        throw Error(`The access key "${friendlyName}"  already exists.`);
      }
    })
    .then(function () {
      var moment = require('moment');
      if (ttl > 0) {
        var newExp = moment(token.get('expires_at'))
          .utc().add(ttl/1000, 'seconds').format('YYYY-MM-DD hh:mm:ss')
        token.set('expires_at', newExp)
      }
      if (friendlyName.length > 0) {
        token.set('name', friendlyName);
      }
      return token.save();
    });
  })
  .then(function (token) {
    var info = {
      name : '(hidden)',
      isSession: token.is_session == 1 ? true :false,
      createdTime : token.created_at,
      createdBy : token.created_by,
      description : token.description,
      expires : token.expires_at,
      friendlyName: token.name,
      id: token.id + ""
    };
    res.send({accessKey: info});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

module.exports = router;

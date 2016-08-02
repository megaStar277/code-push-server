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
  }).catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.post('/', middleware.checkToken, function(req, res, next) {
  var uid = req.users.id;
  var identical = req.users.identical;
  var createdBy = _.trim(req.body.createdBy);
  var description = _.trim(req.body.description);
  var newAccessKey = security.randToken(28).concat(identical);
  accountManager.createAccessKey(uid, newAccessKey, createdBy, description)
  .then(function(newToken){
    var info = {
      name : newToken.tokens,
      createdTime : newToken.created_at,
      createdBy : newToken.created_by,
      description : newToken.description,
    };
    res.send({accessKey:info});
  }).catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.delete('/:accessKey', middleware.checkToken, function(req, res, next){
  var accessKey = _.trim(decodeURI(req.params.accessKey));
  var uid = req.users.id;
  models.UserTokens.destroy({where: {tokens:accessKey, uid: uid}})
  .then(function(rowNum){
    res.send("");
  }).catch(function (e) {
    res.status(406).send(e.message);
  });
});

module.exports = router;

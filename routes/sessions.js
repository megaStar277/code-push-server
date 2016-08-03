var express = require('express');
var router = express.Router();
var _ = require('lodash');
var security = require('../core/utils/security');
var models = require('../models');
var middleware = require('../core/middleware');
var accountManager = require('../core/services/account-manager')();

router.delete('/:machineName', middleware.checkToken, function(req, res, next){
  var machineName = _.trim(decodeURI(req.params.machineName));
  var uid = req.users.id;
  models.UserTokens.destroy({where: {created_by:machineName, uid: uid}})
  .then(function(rowNum){
    res.send("");
  }).catch(function (e) {
    res.status(406).send(e.message);
  });
});

module.exports = router;

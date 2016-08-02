var express = require('express');
var router = express.Router();
var models = require('../models');
var _ = require('lodash');
var bcrypt = require('bcrypt');
var security = require('../core/utils/security');
var accountManager = require('../core/services/account-manager')();

router.get('/login', function(req, res, next) {
  res.render('auth/login', { title: 'CodePushServer' });
});

router.get('/register', function(req, res, next) {
  res.render('auth/register', { title: 'CodePushServer' });
});

router.post('/logout', function (req, res, next) {
  res.send("ok");
});

router.post('/login', function(req, res, next) {
  var account = _.trim(req.body.account);
  var createdBy = _.trim(req.query.hostname);
  var password = _.trim(req.body.password);
  accountManager.login(account, password)
  .then(function (users) {
    if (_.isEmpty(createdBy)){
      createdBy = users.username;
    }
    var newAccessKey = security.randToken(28).concat(users.identical);
    return accountManager.createAccessKey(users.id, newAccessKey, createdBy, 'Login')
  }).then(function (tokens) {
    res.send({status:'OK',results: {tokens: tokens.tokens}});
  }).catch(function (e) {
    res.send({status:'ERROR', errorMessage: e.message});
  });
});

module.exports = router;

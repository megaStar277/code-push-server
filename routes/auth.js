var express = require('express');
var router = express.Router();
var models = require('../models');
var _ = require('lodash');
var bcrypt = require('bcrypt');
var security = require('../core/utils/security');
var accountManager = require('../core/services/account-manager')();
var middleware = require('../core/middleware');


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
  var password = _.trim(req.body.password);
  var config = require('../core/config');
  var loginSecret = _.get(config, 'common.loginSecret');
  accountManager.login(account, password)
  .then(function (users) {
    var jwt = require('jsonwebtoken');
    return jwt.sign({ uid: users.id, hash: security.md5(users.ack_code), expiredIn: 7200 }, loginSecret);
  }).then(function (token) {
    res.send({status:'OK', results: {tokens: token}});
  }).catch(function (e) {
    res.send({status:'ERROR', errorMessage: e.message});
  });
});

module.exports = router;

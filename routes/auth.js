var express = require('express');
var router = express.Router();
var _ = require('lodash');
var security = require('../core/utils/security');
var accountManager = require('../core/services/account-manager')();

router.get('/login', function(req, res, next) {
  var config = require('../core/config');
  var codePushWebUrl = _.get(config, 'common.codePushWebUrl');
  var isRedirect = false;
  if (codePushWebUrl) {
    var validator = require('validator');
    if (validator.isUrl(codePushWebUrl)){
      isRedirect = true;
    }
  }
  if (isRedirect) {
    res.redirect(`${codePushWebUrl}/login`);
  } else {
    res.render('auth/login', { title: 'CodePushServer' });
  }
});

router.get('/link', function(req, res, next) {
  res.redirect(`/auth/login`);
});

router.get('/register', function(req, res, next) {
  var config = require('../core/config');
  var codePushWebUrl = _.get(config, 'common.codePushWebUrl');
  var isRedirect = false;
  if (codePushWebUrl) {
    var validator = require('validator');
    if (validator.isUrl(codePushWebUrl)){
      isRedirect = true;
    }
  }
  if (isRedirect) {
    res.redirect(`${codePushWebUrl}/register`);
  } else {
    res.render('auth/login', { title: 'CodePushServer' });
  }
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
  })
  .then(function (token) {
    res.send({status:'OK', results: {tokens: token}});
  })
  .catch(function (e) {
    res.send({status:'ERROR', errorMessage: e.message});
  });
});

module.exports = router;

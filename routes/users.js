var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var _ = require('lodash');
var models = require('../models');
var middleware = require('../core/middleware');
var AccountManager = require('../core/services/account-manager');

router.get('/', middleware.checkToken, function(req, res) {
  res.send({ title: 'CodePushServer' });
});

router.post('/', function (req, res) {
  var email = _.trim(_.get(req, 'body.email'));
  var token = _.trim(_.get(req, 'body.token'));
  var password = _.trim(_.get(req, 'body.password'));
  var accountManager = new AccountManager();
  return accountManager.checkRegisterCode(email, token)
  .then(function (u) {
    if (_.isString(password) && password.length < 6) {
      throw new Error('请您输入6～20位长度的密码');
    }
    return accountManager.register(email, password);
  })
  .then(function () {
    res.send({status: "OK"});
  })
  .catch(function (e) {
    res.send({status: "ERROR", message: e.message});
  });

});

router.get('/exists', function (req, res) {
  var email = _.trim(_.get(req, 'query.email'));
  models.Users.findOne({where: {email: email}})
  .then(function (u) {
    if (!email) {
      throw new Error(`请您输入邮箱地址`);
    }
    res.send({status: "OK", exists: u ? true : false});
  })
  .catch(function (e) {
    res.send({status: "ERROR", message: e.message});
  });
});

router.post('/registerCode', function (req, res) {
  var email = _.get(req, 'body.email');
  var accountManager = new AccountManager();
  return accountManager.sendRegisterCode(email)
  .then(function () {
    res.send({status: "OK"});
  })
  .catch(function (e) {
    res.send({status: "ERROR", message: e.message});
  });
});

router.get('/registerCode/exists', function (req, res) {
  var email = _.trim(_.get(req, 'query.email'));
  var token = _.trim(_.get(req, 'query.token'));
  var accountManager = new AccountManager();
  return accountManager.checkRegisterCode(email, token)
  .then(function () {
    res.send({status: "OK"});
  })
  .catch(function (e) {
    res.send({status: "ERROR", message: e.message});
  });
});

//修改密码
router.patch('/password', middleware.checkToken, function(req, res) {
  var oldPassword = _.trim(_.get(req, 'body.oldPassword'));
  var newPassword = _.trim(_.get(req, 'body.newPassword'));
  var uid = req.users.id;
  var accountManager = new AccountManager();
  return accountManager.changePassword(uid, oldPassword, newPassword)
  .then(function () {
    res.send({status: "OK"});
  })
  .catch(function (e) {
    res.send({status: "ERROR", message: e.message});
  });
});

module.exports = router;

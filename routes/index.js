var express = require('express');
var router = express.Router();
var middleware = require('../core/middleware');
var ClientManager = require('../core/services/client-manager');
var _ = require('lodash');
var security = require('../core/utils/security');

router.get('/', function(req, res, next) {
  var fs = require('fs');
  var PackageManager = require('../core/services/package-manager');
  var packageManager = new PackageManager();
  var common = require('../core/utils/common');
  res.render('index', { title: 'CodePushServer' });
});

router.get('/updateCheck', function(req, res, next){
  var deploymentKey = _.get(req, "query.deploymentKey");
  var appVersion = _.get(req, "query.appVersion");
  var label = _.get(req, "query.label");
  var packageHash = _.get(req, "query.packageHash")
  var clientManager = new ClientManager();
  clientManager.updateCheck(deploymentKey, appVersion, label, packageHash)
  .then(function (rs) {
    res.send({"updateInfo":rs});
  }).catch(function (e) {
    res.status(404).send(e.message);
  });
});

router.post('/reportStatus/download', function(req, res, next){
  var clientUniqueId = _.get(req, "body.clientUniqueId");
  var label = _.get(req, "body.label");
  var deploymentKey = _.get(req, "body.deploymentKey");
  var clientManager = new ClientManager();
  clientManager.reportStatusDownload(deploymentKey, label, clientUniqueId)
  .catch(function (e) {
    console.log(e);
  });
  res.send('OK');
});

router.post('/reportStatus/deploy', function(req, res, next){
  var clientUniqueId = _.get(req, "body.clientUniqueId");
  var label = _.get(req, "body.label");
  var deploymentKey = _.get(req, "body.deploymentKey");
  var clientManager = new ClientManager();
  clientManager.reportStatusDeploy(deploymentKey, label, clientUniqueId, req.body)
  .catch(function (e) {
    console.log(e);
  });;
  res.send('OK');
});

router.get('/authenticated', middleware.checkToken, function (req, res, next) {
  return res.send({authenticated: true});
})

module.exports = router;

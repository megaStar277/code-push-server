var express = require('express');
var router = express.Router();
var Promise = require('bluebird');
var middleware = require('../core/middleware');
var ClientManager = require('../core/services/client-manager');
var _ = require('lodash');

router.get('/', function(req, res, next) {
  res.render('index', { title: 'CodePushServer' });
});

router.get('/README.md', function(req, res, next) {
  var MarkdownIt = require('markdown-it');
  const path = require('path');
  const fs = require('fs');
  const readFile = Promise.promisify(fs.readFile);
  const README = path.join(__dirname, '../README.md');
  readFile(README, { encoding: 'utf8' })
  .then(source=>{
    var md = new MarkdownIt();
    res.send(md.render(source));
  })
  .catch(e=>{
    res.send(e.message);
  });

});

router.get('/tokens', function(req, res, next) {
  res.render('tokens', { title: '获取token' });
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
  })
  .catch(function (e) {
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

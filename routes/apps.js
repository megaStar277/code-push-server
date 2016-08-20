var express = require('express');
var Promise = require('bluebird');
var router = express.Router();
var _ = require('lodash');
var middleware = require('../core/middleware');
var validator = require('validator');
var accountManager = require('../core/services/account-manager')();
var Deployments = require('../core/services/deployments');
var Collaborators = require('../core/services/collaborators');
var AppManager = require('../core/services/app-manager');
var PackageManager = require('../core/services/package-manager');
var common = require('../core/utils/common');
var config    = require('../core/config');

router.get('/',
  middleware.checkToken, function(req, res, next) {
  var uid = req.users.id;
  var appManager = new AppManager();
  appManager.listApps(uid)
  .then(function (data) {
    res.send({apps: data});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.get('/:appName/deployments',
  middleware.checkToken, function (req, res, next) {
  var uid = req.users.id;
  var appName = _.trim(req.params.appName);
  var deployments = new Deployments();
  accountManager.collaboratorCan(uid, appName)
  .then(function (col) {
    return deployments.listDeloyments(col.appid);
  })
  .then(function (data) {
    res.send({deployments: data});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.post('/:appName/deployments',
  middleware.checkToken, function (req, res, next) {
  var uid = req.users.id;
  var appName = _.trim(req.params.appName);
  var name = req.body.name;
  var deployments = new Deployments();
  accountManager.ownerCan(uid, appName)
  .then(function (col) {
    return deployments.addDeloyment(name, col.appid, uid);
  })
  .then(function (data) {
    res.send({deployment: {name: data.name, key: data.deployment_key}});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.get('/:appName/deployments/:deploymentName/metrics',
  middleware.checkToken, function (req, res, next) {
  var uid = req.users.id;
  var appName = _.trim(req.params.appName);
  var deploymentName = _.trim(req.params.deploymentName);
  var deployments = new Deployments();
  var packageManager = new PackageManager();

  accountManager.collaboratorCan(uid, appName)
  .then(function(col) {
    return deployments.findDeloymentByName(deploymentName, col.appid)
    .then(function (deploymentInfo) {
      if (_.isEmpty(deploymentInfo)) {
        throw new Error("does not find the deployment");
      }
      return deploymentInfo;
    })
  })
  .then(function(deploymentInfo) {
    return deployments.getAllPackageIdsByDeploymentsId(deploymentInfo.id);
  })
  .then(function(packagesInfos) {
    return Promise.reduce(packagesInfos, function (result, v) {
      return packageManager.getMetricsbyPackageId(v.get('id'))
      .then(function (metrics) {
        if (metrics) {
          result[v.get('label')] = {
            active: metrics.get('active'),
            downloaded: metrics.get('downloaded'),
            failed: metrics.get('failed'),
            installed: metrics.get('installed'),
          };
        }
        return result;
      });
    }, {});
  })
  .then(function(rs) {
    res.send({"metrics": rs});
  })
  .catch(function(e){
    res.send({"metrics": null});
  });
});

router.get('/:appName/deployments/:deploymentName/history',
  middleware.checkToken, function (req, res, next) {
  var uid = req.users.id;
  var appName = _.trim(req.params.appName);
  var deploymentName = _.trim(req.params.deploymentName);
  var deployments = new Deployments();
  accountManager.collaboratorCan(uid, appName)
  .then(function(col){
    return deployments.findDeloymentByName(deploymentName, col.appid)
    .then(function (deploymentInfo) {
      if (_.isEmpty(deploymentInfo)) {
        throw new Error("does not find the deployment");
      }
      return deploymentInfo;
    });
  })
  .then(function(deploymentInfo) {
    return deployments.getDeploymentHistory(deploymentInfo.id);
  })
  .then(function (rs) {
    res.send({history: rs});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.delete('/:appName/deployments/:deploymentName/history',
  middleware.checkToken, function (req, res, next) {
  var uid = req.users.id;
  var appName = _.trim(req.params.appName);
  var deploymentName = _.trim(req.params.deploymentName);
  var deployments = new Deployments();
  accountManager.ownerCan(uid, appName)
  .then(function(col){
    return deployments.findDeloymentByName(deploymentName, col.appid)
    .then(function (deploymentInfo) {
      if (_.isEmpty(deploymentInfo)) {
        throw new Error("does not find the deployment");
      }
      return deploymentInfo;
    });
  })
  .then(function(deploymentInfo) {
    return deployments.deleteDeploymentHistory(deploymentInfo.id);
  })
  .then(function (rs) {
    res.send("ok");
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.patch('/:appName/deployments/:deploymentName',
  middleware.checkToken, function (req, res, next) {
  var name = req.body.name;
  var appName = _.trim(req.params.appName);
  var deploymentName = _.trim(req.params.deploymentName);
  var uid = req.users.id;
  var deployments = new Deployments();
  accountManager.ownerCan(uid, appName)
  .then(function (col) {
    return deployments.renameDeloymentByName(deploymentName, col.appid, name);
  })
  .then(function (data) {
    res.send({deployment: data});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.delete('/:appName/deployments/:deploymentName',
  middleware.checkToken, function (req, res, next) {
  var appName = _.trim(req.params.appName);
  var deploymentName = _.trim(req.params.deploymentName);
  var uid = req.users.id;
  var deployments = new Deployments();
  accountManager.ownerCan(uid, appName)
  .then(function (col) {
    return deployments.deleteDeloymentByName(deploymentName, col.appid);
  })
  .then(function (data) {
    res.send({deployment: data});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.post('/:appName/deployments/:deploymentName/release',
  middleware.checkToken, function (req, res, next) {
  var appName = _.trim(req.params.appName);
  var deploymentName = _.trim(req.params.deploymentName);
  var uid = req.users.id;
  var deployments = new Deployments();
  var packageManager = new PackageManager();
  const AREGEX = /^android_/;
  var pubType = '';
  if (AREGEX.test(appName)) {
    pubType = 'android';
  } else {
    pubType = 'ios';
  }
  accountManager.collaboratorCan(uid, appName)
  .then(function (col) {
    return deployments.findDeloymentByName(deploymentName, col.appid)
    .then(function (deploymentInfo) {
      if (_.isEmpty(deploymentInfo)) {
        throw new Error("does not find the deployment");
      }
      return packageManager.parseReqFile(req)
      .then(function (data) {
        return packageManager.releasePackage(deploymentInfo.id, data.packageInfo, data.package.type, data.package.path, uid, pubType)
        .finally(function () {
          common.deleteFolderSync(data.package.path);
        });
      })
      .then(function (packages) {
        if (packages) {
          Promise.delay(2000)
          .then(function () {
            packageManager.createDiffPackagesByLastNums(packages.id, _.get(config, 'common.diffNums', 1))
            .catch(function(e){
              console.log(e);
            });
          });
        }
        return null;
      });
    });
  })
  .then(function (data) {
    res.send("");
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.post('/:appName/deployments/:sourceDeploymentName/promote/:destDeploymentName',
  middleware.checkToken, function (req, res, next) {
  var appName = _.trim(req.params.appName);
  var sourceDeploymentName = _.trim(req.params.sourceDeploymentName);
  var destDeploymentName = _.trim(req.params.destDeploymentName);
  var uid = req.users.id;
  var packageManager = new PackageManager();
  var deployments = new Deployments();
  accountManager.collaboratorCan(uid, appName)
  .then(function (col) {
    var appId = col.appid;
    return Promise.all([
      deployments.findDeloymentByName(sourceDeploymentName, appId),
      deployments.findDeloymentByName(destDeploymentName, appId)
    ])
    .spread(function (sourceDeploymentInfo, destDeploymentInfo) {
      if (!sourceDeploymentInfo) {
        throw new Error(`${sourceDeploymentName}  does not exist.`);
      }
      if (!destDeploymentInfo) {
        throw new Error(`${destDeploymentName}  does not exist.`);
      }
      return [sourceDeploymentInfo.id, destDeploymentInfo.id];
    })
    .spread(function (sourceDeploymentId, destDeploymentId) {
      return packageManager.promotePackage(sourceDeploymentId, destDeploymentId, uid);
    });
  })
  .then(function (packages) {
    if (!_.isEmpty(packages)) {
      Promise.delay(2000)
      .then(function () {
        packageManager.createDiffPackagesByLastNums(packages.id, _.get(config, 'common.diffNums', 1))
        .catch(function(e){
          console.log(e);
        });
      });
    }
    return null;
  })
  .then(function () {
     res.send('ok');
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

var rollbackCb = function (req, res, next) {
  var appName = _.trim(req.params.appName);
  var deploymentName = _.trim(req.params.deploymentName);
  var uid = req.users.id;
  var targetLabel = _.trim(_.get(req, 'params.label'));
  var deployments = new Deployments();
  accountManager.collaboratorCan(uid, appName)
  .then(function (col) {
    return deployments.findDeloymentByName(deploymentName, col.appid);
  });
  res.send('ok');
};

router.post('/:appName/deployments/:deploymentName/rollback',
  middleware.checkToken, rollbackCb);

router.post('/:appName/deployments/:deploymentName/rollback/:label',
  middleware.checkToken, rollbackCb);

router.get('/:appName/collaborators',
  middleware.checkToken, function (req, res, next) {
  var appName = _.trim(req.params.appName);
  var uid = req.users.id;
  var collaborators = new Collaborators();
  accountManager.collaboratorCan(uid, appName).then(function (col) {
    return collaborators.listCollaborators(col.appid);
  })
  .then(function (data) {
    rs = _.reduce(data, function (result, value, key) {
      if (_.eq(key, req.users.email)) {
        value.isCurrentAccount = true;
      }else {
        value.isCurrentAccount = false;
      }
      result[key] = value;
      return result;
    },{});
    res.send({collaborators: rs});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.post('/:appName/collaborators/:email',
  middleware.checkToken, function (req, res, next) {
  var appName = _.trim(req.params.appName);
  var email = _.trim(req.params.email);
  var uid = req.users.id;
  if (!validator.isEmail(email)){
    return res.status(406).send("Invalid Email!");
  }
  var collaborators = new Collaborators();
  accountManager.ownerCan(uid, appName)
  .then(function (col) {
    return accountManager.findUserByEmail(email).then(function (data) {
      return collaborators.addCollaborator(col.appid, data.id);
    });
  })
  .then(function (data) {
    res.send(data);
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.delete('/:appName/collaborators/:email',
  middleware.checkToken, function (req, res, next) {
  var appName = _.trim(req.params.appName);
  var email = _.trim(decodeURI(req.params.email));
  var uid = req.users.id;
  if (!validator.isEmail(email)){
    return res.status(406).send("Invalid Email!");
  }
  var collaborators = new Collaborators();
  accountManager.ownerCan(uid, appName)
  .then(function (col) {
    return accountManager.findUserByEmail(email).then(function (data) {
      if (_.eq(data.id, uid)) {
        throw new Error("can't delete yourself!");
      } else {
        return collaborators.deleteCollaborator(col.appid, data.id);
      }
    });
  })
  .then(function () {
    res.send("");
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.delete('/:appName',
  middleware.checkToken, function (req, res, next) {
  var appName = _.trim(req.params.appName);
  var uid = req.users.id;
  var appManager = new AppManager();
  accountManager.ownerCan(uid, appName)
  .then(function (col) {
    return appManager.deleteApp(col.appid);
  })
  .then(function (data) {
    res.send(data);
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.patch('/:appName',
  middleware.checkToken, function (req, res, next) {
  var newAppName = _.trim(req.body.name);
  var appName = _.trim(req.params.appName);
  var uid = req.users.id;
  if (_.isEmpty(newAppName)) {
    return res.status(406).send("Please input name!");
  } else {
    var appManager = new AppManager();
    return accountManager.ownerCan(uid, appName)
    .then(function (col) {
      return appManager.findAppByName(uid, newAppName)
      .then(function (appInfo) {
        if (!_.isEmpty(appInfo)){
          throw new Error(newAppName + " Exist!");
        }
        return appManager.modifyApp(col.appid, {name: newAppName});
      });
    })
    .then(function () {
      res.send("");
    })
    .catch(function (e) {
      res.status(406).send(e.message);
    });
  }
});

router.post('/:appName/transfer/:email',
  middleware.checkToken, function (req, res, next) {
  var appName = _.trim(req.params.appName);
  var email = _.trim(req.params.email);
  var uid = req.users.id;
  if (!validator.isEmail(email)){
    return res.status(406).send("Invalid Email!");
  }
  return accountManager.ownerCan(uid, appName)
  .then(function (col) {
    return accountManager.findUserByEmail(email)
    .then(function (data) {
      if (_.eq(data.id, uid)) {
        throw new Error("You can't transfer to yourself!");
      }
      var appManager = new AppManager();
      return appManager.transferApp(col.appid, uid, data.id);
    });
  })
  .then(function (data) {
    res.send(data);
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

router.post('/', middleware.checkToken, function (req, res, next) {
  var appName = req.body.name;
  var uid = req.users.id;
  var appManager = new AppManager();
  if (_.isEmpty(appName)) {
    return res.status(406).send("Please input name!");
  }
  const REGEX = /^[android_|ios_]/;
  appManager.findAppByName(uid, appName)
  .then(function (appInfo) {
    if (!_.isEmpty(appInfo)){
      throw new Error(appName + " Exist!");
    }
    if (!REGEX.test(appName)) {
      throw new Error(`appName have to point android_ or ios_ prefix! like android_${appName} ios_${appName}`);
    }
    return appManager.addApp(uid, appName, req.users.identical)
    .then(function () {
      return {name: appName, collaborators: {[req.users.email]: {permission: "Owner"}}};
    });
  })
  .then(function (data) {
    res.send({app: data});
  })
  .catch(function (e) {
    res.status(406).send(e.message);
  });
});

module.exports = router;

import express from 'express';
import _ from 'lodash';
import { logger } from 'kv-logger';

import { AppError } from '../core/app-error';

var middleware = require('../core/middleware');
var ClientManager = require('../core/services/client-manager');

const router = express.Router();

router.get('/', (req, res, next) => {
    res.render('index', { title: 'CodePushServer' });
});

router.get('/tokens', (req, res) => {
    res.render('tokens', { title: '获取token' });
});

router.get('/updateCheck', (req, res, next) => {
    var deploymentKey = _.get(req, 'query.deploymentKey');
    var appVersion = _.get(req, 'query.appVersion');
    var label = _.get(req, 'query.label');
    var packageHash = _.get(req, 'query.packageHash');
    var clientUniqueId = _.get(req, 'query.clientUniqueId');
    var clientManager = new ClientManager();
    logger.debug('/updateCheck', {
        query: req.query,
    });
    clientManager
        .updateCheckFromCache(deploymentKey, appVersion, label, packageHash, clientUniqueId)
        .then((rs) => {
            //灰度检测
            return clientManager
                .chosenMan(rs.packageId, rs.rollout, clientUniqueId)
                .then((data) => {
                    if (!data) {
                        rs.isAvailable = false;
                        return rs;
                    }
                    return rs;
                });
        })
        .then((rs) => {
            delete rs.packageId;
            delete rs.rollout;
            res.send({ updateInfo: rs });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(404).send(e.message);
            } else {
                next(e);
            }
        });
});

router.post('/reportStatus/download', (req, res) => {
    logger.debug('/reportStatus/download', {
        body: req.body,
    });
    var clientUniqueId = _.get(req, 'body.clientUniqueId');
    var label = _.get(req, 'body.label');
    var deploymentKey = _.get(req, 'body.deploymentKey');
    var clientManager = new ClientManager();
    clientManager.reportStatusDownload(deploymentKey, label, clientUniqueId).catch((err) => {
        if (!err instanceof AppError) {
            logger.error(err);
        }
    });
    res.send('OK');
});

router.post('/reportStatus/deploy', (req, res) => {
    logger.debug('/reportStatus/deploy', {
        body: req.body,
    });
    var clientUniqueId = _.get(req, 'body.clientUniqueId');
    var label = _.get(req, 'body.label');
    var deploymentKey = _.get(req, 'body.deploymentKey');
    var clientManager = new ClientManager();
    clientManager
        .reportStatusDeploy(deploymentKey, label, clientUniqueId, req.body)
        .catch((err) => {
            if (!err instanceof AppError) {
                logger.error(err);
            }
        });
    res.send('OK');
});

router.get('/authenticated', middleware.checkToken, (req, res) => {
    return res.send({ authenticated: true });
});

module.exports = router;

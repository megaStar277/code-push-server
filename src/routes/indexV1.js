import express from 'express';
import _ from 'lodash';
import { logger } from 'kv-logger';

import { AppError } from '../core/app-error';
import { clientManager } from '../core/services/client-manager';

const router = express.Router();

router.get('/update_check', (req, res, next) => {
    var deploymentKey = _.get(req, 'query.deployment_key');
    var appVersion = _.get(req, 'query.app_version');
    var label = _.get(req, 'query.label');
    var packageHash = _.get(req, 'query.package_hash');
    var isCompanion = _.get(req, 'query.is_companion');
    var clientUniqueId = _.get(req, 'query.client_unique_id');
    logger.debug('/update_check req.query', req.query);
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
            var update_info = {
                download_url: rs.downloadUrl,
                description: rs.description,
                is_available: rs.isAvailable,
                is_disabled: rs.isDisabled,
                // Note: need to use appVersion here to get it compatible with client side change...
                // https://github.com/microsoft/code-push/commit/7d2ffff395cc54db98aefba7c67889f509e8c249#diff-a937c637a47cbd31cbb52c89bef7d197R138
                target_binary_range: rs.appVersion,
                label: rs.label,
                package_hash: rs.packageHash,
                package_size: rs.packageSize,
                should_run_binary_version: rs.shouldRunBinaryVersion,
                update_app_version: rs.updateAppVersion,
                is_mandatory: rs.isMandatory,
            };
            res.send({ update_info: update_info });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.status(404).send(e.message);
            } else {
                next(e);
            }
        });
});

router.post('/report_status/download', (req, res) => {
    logger.debug('/report_status/download req.body', req.body);
    var clientUniqueId = _.get(req, 'body.client_unique_id');
    var label = _.get(req, 'body.label');
    var deploymentKey = _.get(req, 'body.deployment_key');
    clientManager.reportStatusDownload(deploymentKey, label, clientUniqueId).catch((err) => {
        if (!err instanceof AppError) {
            logger.error(err);
        }
    });
    res.send('OK');
});

router.post('/report_status/deploy', (req, res) => {
    logger.debug('/report_status/deploy req.body', req.body);
    var clientUniqueId = _.get(req, 'body.client_unique_id');
    var label = _.get(req, 'body.label');
    var deploymentKey = _.get(req, 'body.deployment_key');
    clientManager
        .reportStatusDeploy(deploymentKey, label, clientUniqueId, req.body)
        .catch((err) => {
            if (!err instanceof AppError) {
                logger.error(err);
            }
        });
    res.send('OK');
});

module.exports = router;

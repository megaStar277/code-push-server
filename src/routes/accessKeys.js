import express from 'express';
import _ from 'lodash';
import { logger } from 'kv-logger';
import { UserTokens } from '../models/user_tokens';
import { AppError } from '../core/app-error';
import { accountManager } from '../core/services/account-manager';

var security = require('../core/utils/security');
var middleware = require('../core/middleware');

const router = express.Router();

router.get('/', middleware.checkToken, (req, res, next) => {
    logger.debug('request get acceesKeys');
    var uid = req.users.id;
    accountManager
        .getAllAccessKeyByUid(uid)
        .then((accessKeys) => {
            logger.debug('acceesKeys:', accessKeys);
            res.send({ accessKeys: accessKeys });
        })
        .catch((e) => {
            next(e);
        });
});

router.post('/', middleware.checkToken, (req, res, next) => {
    var uid = req.users.id;
    var identical = req.users.identical;
    var createdBy = _.trim(req.body.createdBy);
    var friendlyName = _.trim(req.body.friendlyName);
    var ttl = parseInt(req.body.ttl);
    var description = _.trim(req.body.description);
    logger.info('try to generate access key', {
        uid,
        ...req.body,
    });
    var newAccessKey = security.randToken(28).concat(identical);
    return accountManager
        .isExsitAccessKeyName(uid, friendlyName)
        .then((data) => {
            if (!_.isEmpty(data)) {
                throw new AppError(`The access key "${friendlyName}"  already exists.`);
            }
        })
        .then(() => {
            return accountManager.createAccessKey(
                uid,
                newAccessKey,
                ttl,
                friendlyName,
                createdBy,
                description,
            );
        })
        .then((newToken) => {
            var moment = require('moment');
            var info = {
                name: newToken.tokens,
                createdTime: parseInt(moment(newToken.created_at).format('x')),
                createdBy: newToken.created_by,
                expires: parseInt(moment(newToken.expires_at).format('x')),
                description: newToken.description,
                friendlyName: newToken.name,
            };
            logger.info('access key created', {
                uid,
                friendlyName: newToken.name,
            });
            logger.debug('access key', {
                uid,
                ...info,
            });
            res.send({ accessKey: info });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                logger.debug(e);
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});

router.delete('/:name', middleware.checkToken, (req, res, next) => {
    var name = _.trim(decodeURI(req.params.name));
    var uid = req.users.id;
    return UserTokens.destroy({ where: { name: name, uid: uid } })
        .then((rowNum) => {
            logger.debug('delete acceesKey:', name);
            res.send({ friendlyName: name });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                logger.debug(e);
                res.status(406).send(e.message);
            } else {
                next(e);
            }
        });
});
module.exports = router;

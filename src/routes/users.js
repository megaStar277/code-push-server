import express from 'express';
import { logger } from 'kv-logger';
import _ from 'lodash';

import { Users } from '../models/users';
import { AppError } from '../core/app-error';

var middleware = require('../core/middleware');
var AccountManager = require('../core/services/account-manager');

const router = express.Router();

router.get('/', middleware.checkToken, (req, res) => {
    res.send({ title: 'CodePushServer' });
});

router.post('/', (req, res, next) => {
    var email = _.trim(_.get(req, 'body.email'));
    var token = _.trim(_.get(req, 'body.token'));
    var password = _.trim(_.get(req, 'body.password'));
    var accountManager = new AccountManager();
    return accountManager
        .checkRegisterCode(email, token)
        .then((u) => {
            if (_.isString(password) && password.length < 6) {
                throw new AppError('请您输入6～20位长度的密码');
            }
            return accountManager.register(email, password);
        })
        .then(() => {
            res.send({ status: 'OK' });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.send({ status: 'ERROR', message: e.message });
            } else {
                next(e);
            }
        });
});

router.get('/exists', (req, res, next) => {
    var email = _.trim(_.get(req, 'query.email'));
    Users.findOne({ where: { email: email } })
        .then((u) => {
            if (!email) {
                throw new AppError(`请您输入邮箱地址`);
            }
            res.send({ status: 'OK', exists: u ? true : false });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.send({ status: 'ERROR', message: e.message });
            } else {
                next(e);
            }
        });
});

router.post('/registerCode', (req, res, next) => {
    var email = _.get(req, 'body.email');
    var accountManager = new AccountManager();
    logger.info('try send register code', { email });
    return accountManager
        .sendRegisterCode(email)
        .then(() => {
            logger.info('send register code success', { email });
            res.send({ status: 'OK' });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                logger.warn('send register code error', { email, message: e.message });
                res.send({ status: 'ERROR', message: e.message });
            } else {
                next(e);
            }
        });
});

router.get('/registerCode/exists', (req, res, next) => {
    var email = _.trim(_.get(req, 'query.email'));
    var token = _.trim(_.get(req, 'query.token'));
    var accountManager = new AccountManager();
    return accountManager
        .checkRegisterCode(email, token)
        .then(() => {
            res.send({ status: 'OK' });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.send({ status: 'ERROR', message: e.message });
            } else {
                next(e);
            }
        });
});

//修改密码
router.patch('/password', middleware.checkToken, (req, res, next) => {
    var oldPassword = _.trim(_.get(req, 'body.oldPassword'));
    var newPassword = _.trim(_.get(req, 'body.newPassword'));
    var uid = req.users.id;
    var accountManager = new AccountManager();
    return accountManager
        .changePassword(uid, oldPassword, newPassword)
        .then(() => {
            res.send({ status: 'OK' });
        })
        .catch((e) => {
            if (e instanceof AppError) {
                res.send({ status: 'ERROR', message: e.message });
            } else {
                next(e);
            }
        });
});

module.exports = router;

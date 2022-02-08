const express = require('express');
const _ = require('lodash');
const validator = require('validator');
const { logger } = require('kv-logger');
const jwt = require('jsonwebtoken');

const config = require('../core/config');

const router = express.Router();

router.get('/password', (req, res) => {
    res.render('auth/password', { title: 'CodePushServer' });
});

router.get('/login', (req, res) => {
    var codePushWebUrl = _.get(config, 'common.codePushWebUrl');
    if (codePushWebUrl && validator.isURL(codePushWebUrl)) {
        logger.debug(`login redirect:${codePushWebUrl}`);
        res.redirect(`${codePushWebUrl}/login`);
    } else {
        res.render('auth/login', { title: 'CodePushServer', email: req.query.email || '' });
    }
});

router.get('/link', (req, res) => {
    res.redirect(`/auth/login`);
});

router.get('/register', (req, res) => {
    var codePushWebUrl = _.get(config, 'common.codePushWebUrl');
    var isRedirect = false;
    if (codePushWebUrl && validator.isURL(codePushWebUrl)) {
        logger.debug(`register redirect:${codePushWebUrl}`);
        res.redirect(`${codePushWebUrl}/register`);
    } else {
        if (_.get(config, 'common.allowRegistration')) {
            res.render('auth/register', { title: 'CodePushServer', email: req.query.email || '' });
        } else {
            res.redirect(`/auth/login`);
        }
    }
});

router.get('/confirm', (req, res) => {
    logger.debug(`confirmation form`);
    res.render('auth/confirm', { title: 'CodePushServer', email: req.query.email || '' });
});

router.post('/logout', (req, res) => {
    res.send('ok');
});

router.post('/login', (req, res, next) => {
    var AppError = require('../core/app-error');
    var accountManager = require('../core/services/account-manager')();
    var security = require('../core/utils/security');
    var account = _.trim(req.body.account);
    var password = _.trim(req.body.password);
    var tokenSecret = _.get(config, 'jwt.tokenSecret');
    logger.info('try login', {
        account,
    });
    accountManager
        .login(account, password)
        .then((users) => {
            logger.info('login success', {
                account,
                uid: users.id,
            });
            return jwt.sign(
                { uid: users.id, hash: security.md5(users.ack_code), expiredIn: 7200 },
                tokenSecret,
            );
        })
        .then((token) => {
            logger.debug('login jwt token', {
                account,
                token,
            });
            res.send({ status: 'OK', results: { tokens: token } });
        })
        .catch((e) => {
            if (e instanceof AppError.AppError) {
                logger.debug(e);
                res.send({ status: 'ERROR', errorMessage: e.message });
            } else {
                next(e);
            }
        });
});

module.exports = router;

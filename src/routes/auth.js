import express from 'express';
import _ from 'lodash';
import validator from 'validator';
import { logger } from 'kv-logger';
import jwt from 'jsonwebtoken';

import { config } from '../core/config';
import { AppError } from '../core/app-error';
import { accountManager } from '../core/services/account-manager';

var security = require('../core/utils/security');

const router = express.Router();

router.get('/password', (req, res) => {
    res.render('auth/password', { title: 'CodePushServer' });
});

router.get('/login', (req, res) => {
    res.render('auth/login', { title: 'CodePushServer', email: req.query.email || '' });
});

router.get('/link', (req, res) => {
    res.redirect(`/auth/login`);
});

router.get('/register', (req, res) => {
    if (_.get(config, 'common.allowRegistration')) {
        res.render('auth/register', { title: 'CodePushServer', email: req.query.email || '' });
    } else {
        res.redirect(`/auth/login`);
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
            if (e instanceof AppError) {
                logger.debug(e);
                res.send({ status: 'ERROR', errorMessage: e.message });
            } else {
                next(e);
            }
        });
});

module.exports = router;

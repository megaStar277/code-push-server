import express from 'express';
import { logger } from 'kv-logger';
import { checkToken } from '../core/middleware';

const router = express.Router();

router.get('/', checkToken, (req, res) => {
    var userInfo = {
        email: req.users.email,
        linkedProviders: [],
        name: req.users.username,
    };
    logger.info('check account info', userInfo);
    res.send({ account: userInfo });
});

module.exports = router;

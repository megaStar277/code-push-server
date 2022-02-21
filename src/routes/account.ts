import express from 'express';
import { checkToken, Req } from '../core/middleware';

export const accountRouter = express.Router();

accountRouter.get('/', checkToken, (req: Req, res) => {
    const { logger } = req;
    const userInfo = {
        email: req.users.email,
        linkedProviders: [],
        name: req.users.username,
    };
    logger.info('check account info', userInfo);
    res.send({ account: userInfo });
});

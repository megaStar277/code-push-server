import express from 'express';
import { AppError } from '../core/app-error';
import { checkToken, Req } from '../core/middleware';
import { clientManager } from '../core/services/client-manager';

export const indexRouter = express.Router();

indexRouter.get('/', (req, res) => {
    res.render('index', { title: 'CodePushServer' });
});

indexRouter.get('/tokens', (req, res) => {
    res.render('tokens', { title: '获取token' });
});

indexRouter.get(
    '/updateCheck',
    (
        req: Req<
            void,
            void,
            {
                deploymentKey: string;
                appVersion: string;
                label: string;
                packageHash: string;
                clientUniqueId: string;
            }
        >,
        res,
        next,
    ) => {
        const { logger, query } = req;
        logger.debug('/updateCheck', {
            query: JSON.stringify(query),
        });
        const { deploymentKey, appVersion, label, packageHash, clientUniqueId } = query;
        clientManager
            .updateCheckFromCache(
                deploymentKey,
                appVersion,
                label,
                packageHash,
                clientUniqueId,
                logger,
            )
            .then((rs) => {
                // 灰度检测
                return clientManager
                    .chosenMan(rs.packageId, rs.rollout, clientUniqueId)
                    .then((data) => {
                        if (!data) {
                            // eslint-disable-next-line no-param-reassign
                            rs.isAvailable = false;
                            return rs;
                        }
                        return rs;
                    });
            })
            .then((rs) => {
                // eslint-disable-next-line no-param-reassign
                delete rs.packageId;
                // eslint-disable-next-line no-param-reassign
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
    },
);

indexRouter.post(
    '/reportStatus/download',
    (
        req: Req<
            void,
            {
                clientUniqueId: string;
                label: string;
                deploymentKey: string;
            },
            void
        >,
        res,
    ) => {
        const { logger, body } = req;
        logger.debug('/reportStatus/download', {
            body: JSON.stringify(body),
        });
        const { clientUniqueId, label, deploymentKey } = body;
        clientManager.reportStatusDownload(deploymentKey, label, clientUniqueId).catch((err) => {
            if (!(err instanceof AppError)) {
                logger.error(err);
            }
        });
        res.send('OK');
    },
);

indexRouter.post(
    '/reportStatus/deploy',
    (
        req: Req<
            void,
            {
                clientUniqueId: string;
                label: string;
                deploymentKey: string;
            },
            void
        >,
        res,
    ) => {
        const { logger, body } = req;
        logger.debug('/reportStatus/deploy', {
            body: JSON.stringify(body),
        });
        const { clientUniqueId, label, deploymentKey } = body;
        clientManager
            .reportStatusDeploy(deploymentKey, label, clientUniqueId, req.body)
            .catch((err) => {
                if (!(err instanceof AppError)) {
                    logger.error(err);
                }
            });
        res.send('OK');
    },
);

indexRouter.get('/authenticated', checkToken, (req, res) => {
    return res.send({ authenticated: true });
});

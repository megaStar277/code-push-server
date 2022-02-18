import jwt from 'jsonwebtoken';
import _ from 'lodash';
import moment from 'moment';
import { Op } from 'sequelize';
import { UserTokens } from '../models/user_tokens';
import { Users } from '../models/users';
import { AppError, Unauthorized } from './app-error';
import { config } from './config';
import { parseToken, md5 } from './utils/security';

function checkAuthToken(authToken) {
    const objToken = parseToken(authToken);
    return Users.findOne({
        where: { identical: objToken.identical },
    })
        .then((users) => {
            if (_.isEmpty(users)) {
                throw new Unauthorized();
            }
            return UserTokens.findOne({
                where: {
                    tokens: authToken,
                    uid: users.id,
                    expires_at: {
                        [Op.gt]: moment().format('YYYY-MM-DD HH:mm:ss'),
                    },
                },
            }).then((tokenInfo) => {
                if (_.isEmpty(tokenInfo)) {
                    throw new Unauthorized();
                }
                return users;
            });
        })
        .then((users) => {
            return users;
        });
}

function checkAccessToken(accessToken) {
    return new Promise((resolve, reject) => {
        if (_.isEmpty(accessToken)) {
            reject(new Unauthorized());
            return;
        }
        let authData;
        try {
            authData = jwt.verify(accessToken, config.jwt.tokenSecret);
        } catch (e) {
            reject(new Unauthorized());
            return;
        }
        const uid = _.get(authData, 'uid', null);
        const hash = _.get(authData, 'hash', null);
        if (parseInt(uid, 10) > 0) {
            Users.findOne({
                where: { id: uid },
            })
                .then((users) => {
                    if (_.isEmpty(users)) {
                        throw new Unauthorized();
                    }
                    if (!_.eq(hash, md5(users.get('ack_code')))) {
                        throw new Unauthorized();
                    }
                    resolve(users);
                })
                .catch((e) => {
                    reject(e);
                });
            return;
        }
        reject(new Unauthorized());
    });
}

export function checkToken(req, res, next) {
    const authArr = _.split(req.get('Authorization'), ' ');
    let authType = 1;
    let authToken = '';
    if (_.eq(authArr[0], 'Bearer')) {
        [, authToken] = authArr; // Bearer
        if (authToken && authToken.length > 64) {
            authType = 2;
        } else {
            authType = 1;
        }
    } else if (_.eq(authArr[0], 'Basic')) {
        authType = 2;
        const b = Buffer.from(authArr[1], 'base64');
        const user = _.split(b.toString(), ':');
        [, authToken] = user;
    }
    if (authToken && authType === 1) {
        checkAuthToken(authToken)
            .then((users) => {
                req.users = users;
                next();
                return users;
            })
            .catch((e) => {
                if (e instanceof AppError) {
                    res.status(e.status || 404).send(e.message);
                } else {
                    next(e);
                }
            });
    } else if (authToken && authType === 2) {
        checkAccessToken(authToken)
            .then((users) => {
                req.users = users;
                next();
                return users;
            })
            .catch((e) => {
                if (e instanceof AppError) {
                    res.status(e.status || 404).send(e.message);
                } else {
                    next(e);
                }
            });
    } else {
        res.send(new Unauthorized(`Auth type not supported.`));
    }
}

var express = require('express');
var router = express.Router();
var middleware = require('../core/middleware');
var { logger } = require('kv-logger');

router.get('/', middleware.checkToken, (req, res) => {
    var userInfo = {
        email: req.users.email,
        linkedProviders: [],
        name: req.users.username,
    };
    logger.debug(userInfo);
    res.send({ account: userInfo });
});

module.exports = router;

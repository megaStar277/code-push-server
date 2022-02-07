const _ = require('lodash');
const path = require('path');
const { setLogTransports, ConsoleTransport, LogLevelFilter, logger } = require('kv-logger');

const env = process.env.NODE_ENV || 'development';

let CONFIG_PATH = path.join(__dirname, '../config/config.js');
if (process.env.CONFIG_FILE) {
    CONFIG_PATH = path.join(__dirname, path.relative(__dirname, process.env.CONFIG_FILE));
}

const config = require(CONFIG_PATH);
if (_.isEmpty(config)) {
    throw new Error(`config is {}, check the config`);
}

// config logger
setLogTransports([
    new LogLevelFilter(
        new ConsoleTransport(_.get(config, 'log.format')),
        _.get(config, 'log.level'),
    ),
]);

logger.info(`use config`, {
    config: CONFIG_PATH,
    env: env,
});

module.exports = config;

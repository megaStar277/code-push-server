var env       = process.env.NODE_ENV || 'development';
var CONFIG_FILE = process.env.CONFIG_FILE || './config/config.js';
var path = require('path');
var _    = require('lodash');
var CONFIG_PATH = path.join(__dirname, path.relative(__dirname, CONFIG_FILE));
var config    = _.get(require(CONFIG_PATH), env);
module.exports = config;

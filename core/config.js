var env       = process.env.NODE_ENV || 'development';
var CONFIG_FILE = process.env.CONFIG_FILE || __dirname + '/../config/config.json';
var _         = require('lodash');
var config    = _.get(require(CONFIG_FILE), env);
module.exports = config;

var env       = process.env.NODE_ENV || 'development';
var _    = require('lodash');
var path = require('path');
var config = {};
if (process.env.CONFIG_FILE) {
  var CONFIG_PATH = path.join(__dirname, path.relative(__dirname, process.env.CONFIG_FILE));
  config = _.get(require(CONFIG_PATH), env);
} else {
  config = _.get(require('../config/config.js'), env);
}
module.exports = config;

var express = require('express');
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var helmet = require('helmet');
var config = require('./core/config');
var _ = require('lodash');
var fs = require('fs');

var routes = require('./routes/index');
var auth = require('./routes/auth');
var accessKeys = require('./routes/accessKeys');
var sessions = require('./routes/sessions');
var account = require('./routes/account');
var users = require('./routes/users');
var apps = require('./routes/apps');
var AppError = require('./core/app-error');
var app = express();
app.use(helmet());
app.disable('x-powered-by');

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'pug');

// uncomment after placing your favicon in /public
//app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')));
if (app.get('env') === 'development') {
  app.use(logger('dev'));
} else if (app.get('env') === 'production'){
  app.use(logger('combined',{skip: function (req, res) { return res.statusCode < 400 }}));
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

//use nginx in production
if (app.get('env') === 'development') {
  app.all('*', function(req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "Origin, X-Requested-With, Content-Type, Accept, Authorization");
    res.header("Access-Control-Allow-Methods","PUT,POST,GET,PATCH,DELETE,OPTIONS");
    next();
  });
}

if (_.get(config, 'common.storageType') === 'local'
  && _.get(config, 'local.storageDir')
  ) {
  if (!fs.existsSync(_.get(config, 'local.storageDir'))) {
    var dir = _.get(config, 'local.storageDir');
    throw new Error(`Please create dir ${dir}`);
  }
  app.use(_.get(config, 'local.public', '/download'), express.static(_.get(config, 'local.storageDir')));
}

app.use('/', routes);
app.use('/auth', auth);
app.use('/accessKeys', accessKeys);
app.use('/sessions', sessions);
app.use('/account', account);
app.use('/users', users);
app.use('/apps', apps);

// development error handler
// will print stacktrace
if (app.get('env') === 'development') {
  app.use(function(req, res, next) {
    var err = new AppError.NotFound();
    res.status(err.status || 404);
    res.render('error', {
      message: err.message,
      error: err
    });
    console.error(err.stack);
  });
  app.use(function(err, req, res, next) {
    if (err instanceof AppError.AppError) {
      res.send(err);
    } else {
      res.status(err.status || 500);
      res.render('error', {
        message: err.message,
        error: err
      });
      console.error(err.stack);
    }
  });
} else {
  app.use(function(req, res, next) {
    res.status(404).send(new AppError.NotFound());
  });
  // production error handler
  // no stacktraces leaked to user
  app.use(function(err, req, res, next) {
    if (err instanceof AppError.AppError) {
      res.send(err);
    } else {
      var status = err.status || 500;
      var error = new AppError.AppError(`服务器繁忙，请稍后再试!`);
      error.status = status;
      res.status(status).send(error);
      console.error(err.stack);
    }
  });
}

module.exports = app;

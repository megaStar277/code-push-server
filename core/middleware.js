'use strict';
var _ = require('lodash');
var security = require('../core/utils/security');
var models = require('../models');

var middleware = module.exports = {
  checkToken : function(req, res, next) {
    var authToken = _.trim(_.trimStart(req.get('Authorization'), "Bearer"));
    if (_.isEmpty(authToken) || authToken.length != 37) {
      res.status(401).send('401 Unauthorized');
    } else {
      var objToken = security.parseToken(authToken);
      models.Users.findOne({
        where: {identical: objToken.identical}
      }).then(function(users) {
        if (_.isEmpty(users)) {
          throw new Error('401 Unauthorized');
        }
        return models.UserTokens.findOne({
          where: {tokens: authToken, uid: users.id}
        }).then(function(tokenInfo){
          if (_.isEmpty(tokenInfo)){
            throw new Error('401 Unauthorized')
          } else {
            req.users = users;
          }
          return tokenInfo;
        })
      }).then(function (data) {
        next();
        return data;
      }).catch(function (e) {
        res.status(401).send(e.message);
      });
    }
  },
};

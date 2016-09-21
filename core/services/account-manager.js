'use strict';
var Promise = require('bluebird');
var models = require('../../models');
var _ = require('lodash');
var validator = require('validator');
var security = require('../utils/security');
var factory = require('../utils/factory');
var moment = require('moment');
var EmailManager = require('./email-manager');
var config = require('../config');

var proto = module.exports = function (){
  function AccountManager() {

  }
  AccountManager.__proto__ = proto;
  return AccountManager;
};

proto.collaboratorCan = function(uid, appName) {
  return this.getCollaborator(uid, appName)
  .then(function (data) {
    if (!data) {
      throw new Error("Permission Deny!");
    }
    return data;
  });
};

proto.ownerCan = function(uid, appName) {
  return this.getCollaborator(uid, appName)
  .then(function (data) {
    if (!data || !_.eq(_.get(data,'roles'), 'Owner') ) {
      throw new Error("Permission Deny!");
    }
    return data;
  });
};

proto.getCollaborator = function (uid, appName) {
  return models.Collaborators.findByAppNameAndUid(uid, appName);
};

proto.findUserByEmail = function (email) {
  return models.Users.findOne({where: {email: email}})
  .then(function (data) {
    if (_.isEmpty(data)) {
      throw new Error(email + " does not exist.");
    } else {
      return data;
    }
  });
};

proto.getAllAccessKeyByUid = function (uid) {
  return models.UserTokens.findAll({where: {uid: uid}, order:[['id', 'DESC']]})
  .then(function (tokens) {
    return _.map(tokens, function(v){
      return {
        id: v.id + "",
        name: '(hidden)',
        createdTime: parseInt(moment(v.created_at).format('x')),
        createdBy: v.created_by,
        expires: parseInt(moment(v.expires_at).format('x')),
        friendlyName: v.name,
        isSession: v.is_session == 0 ? false : true,
        description: v.description,
      };
    });
  });
};

proto.isExsitAccessKeyName = function (uid, friendlyName) {
  return models.UserTokens.findOne({
    where: {uid: uid, name: friendlyName}
  });
};

proto.createAccessKey = function (uid, newAccessKey, isSession, ttl, friendlyName, createdBy, description) {
  return models.UserTokens.create({
    uid: uid,
    name: friendlyName,
    tokens: newAccessKey,
    description: description,
    is_session: isSession ? true : false,
    created_by: createdBy,
    expires_at: moment().add(ttl/1000, 'seconds').format('YYYY-MM-DD HH:mm:ss'),
    created_at: moment().format('YYYY-MM-DD HH:mm:ss'),
  });
};

const LOGIN_LIMIT_PRE = 'LOGIN_LIMIT_PRE_';

proto.login = function (account, password) {
  if (_.isEmpty(account)) {
    return Promise.reject(new Error("请您输入邮箱地址"))
  }
  if (_.isEmpty(password)) {
    return Promise.reject(new Error("请您输入密码"))
  }
  var where = {};
  if (validator.isEmail(account)) {
    where = {email: account};
  }else {
    where = {username: account};
  }
  var tryLoginTimes = _.get(config, 'common.tryLoginTimes', 0);
  return models.Users.findOne({where: where})
  .then(function(users) {
    if (_.isEmpty(users)) {
      throw new Error("您输入的邮箱或密码有误");
    }
    return users;
  })
  .then(function (users) {
    if (tryLoginTimes > 0) {
      var loginKey = `${LOGIN_LIMIT_PRE}${users.id}`;
      var client = factory.getRedisClient("default");
      return client.getAsync(loginKey)
      .then(function (loginErrorTimes) {
        if (loginErrorTimes > tryLoginTimes) {
          throw new Error(`您输入密码错误次数超过限制，帐户已经锁定`);
        }
        return users;
      });
    } else {
      return users;
    }
  })
  .then(function (users) {
    if (!security.passwordVerifySync(password, users.password)) {
      if (tryLoginTimes > 0) {
        var loginKey = `${LOGIN_LIMIT_PRE}${users.id}`;
        var client = factory.getRedisClient("default");
        client.existsAsync(loginKey)
        .then(function (isExists) {
          if (!isExists) {
            var expires = moment().endOf('day').format('X') - moment().format('X');
            return client.setexAsync(loginKey, expires, 0);
          }
          return isExists;
        })
        .then(function () {
          return client.incrAsync(loginKey);
        });
      }
      throw new Error("您输入的邮箱或密码有误");
    } else {
      return users;
    }
  });
};

const REGISTER_CODE = "REGISTER_CODE_";
const EXPIRED = 1200;
const EXPIRED_SPEED = 10;

proto.sendRegisterCode = function (email) {
  if (_.isEmpty(email)) {
    return Promise.reject(new Error("请您输入邮箱地址"));
  }
  return models.Users.findOne({where: {email: email}})
  .then(function (u) {
    if (u) {
      throw new Error(`"${email}" 已经注册，请更换邮箱注册`);
    }
  })
  .then(function () {
    //将token临时存储到redis
    var token = security.randToken(40);
    return factory.getRedisClient("default").setexAsync(`${REGISTER_CODE}${security.md5(email)}`, EXPIRED, token)
    .then(function () {
      return token;
    });
  })
  .then(function (token) {
    //将token发送到用户邮箱
    var emailManager = new EmailManager();
    return emailManager.sendRegisterCode(email, token);
  })
};

proto.checkRegisterCode = function (email, token) {
  return models.Users.findOne({where: {email: email}})
  .then(function (u) {
    if (u) {
      throw new Error(`"${email}" 已经注册过，请更换邮箱注册`);
    }
  })
  .then(function () {
    var registerKey = `${REGISTER_CODE}${security.md5(email)}`;
    var client = factory.getRedisClient("default");
    return client.getAsync(registerKey)
    .then(function (storageToken) {
      if (_.isEmpty(storageToken)) {
        throw new Error(`验证码已经失效，请您重新获取`);
      }
      if (!_.eq(token, storageToken)) {
        client.ttlAsync(registerKey)
        .then(function (ttl) {
          if (ttl > 0) {
            return client.expireAsync(registerKey, ttl - EXPIRED_SPEED);
          }
          return ttl;
        })
        throw new Error(`您输入的验证码不正确，请重新输入`);
      }
      return storageToken;
    })
  })
}

proto.register = function (email, password) {
  return models.Users.findOne({where: {email: email}})
  .then(function (u) {
    if (u) {
      throw new Error(`"${email}" 已经注册过，请更换邮箱注册`);
    }
  })
  .then(function () {
    var identical = security.randToken(9);
    return models.Users.create({
      email: email,
      password: security.passwordHashSync(password),
      identical: identical
    });
  })
}

proto.changePassword = function (uid, oldPassword, newPassword) {
  if (!_.isString(newPassword) || newPassword.length < 6) {
    return Promise.reject(new Error("请您输入6～20位长度的新密码"));
  }
  return models.Users.findOne({where: {id: uid}})
  .then(function (u) {
    if (!u) {
      throw new Error(`未找到用户信息`);
    }
    return u;
  })
  .then(function (u) {
    var isEq = security.passwordVerifySync(oldPassword, u.get('password'));
    if (!isEq) {
      throw new Error(`您输入的旧密码不正确，请重新输入`);
    }
    u.set('password', security.passwordHashSync(newPassword));
    u.set('ack_code', security.randToken(5));
    return u.save();
  });
};


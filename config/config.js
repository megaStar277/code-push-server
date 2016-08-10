var config = {};
config.development = {
  //数据库配置
  db: {
    username: "root",
    password: null,
    database: "codepush",
    host: "127.0.0.1",
    dialect: "mysql"
  },
  //七牛云存储配置 当storageType为qiniu时需要配置
  qiniu: {
    accessKey: "",
    secretKey: "",
    bucketName: "",
    downloadUrl: "" //文件下载域名地址
  },
  //文件存储在本地配置 当storageType为local时需要配置
  local: {
    storageDir: "/Users/tablee/workspaces/storage",
    //文件下载地址 CodePush Server 地址 + '/download' download对应app.js里面的地址
    downloadUrl: "http://localhost:3000/download"
  },
  common: {
    //登录jwt签名密钥，必须更改，否则有安全隐患，可以随机生成字符串
    loginSecret: "CodePushServer",
    //当天登录密码错误尝试次数，超过次数帐户将会锁定。0:表示无限制，可能会出现暴力破解。 大于0:必须开启redis服务。
    tryLoginTimes: 0,
    //CodePush Web部署地址，也可以配置成CodePush Web登录地址
    codePushWebUrl: "http://localhost:3001/login",
    //差异化更新版本生成数目 默认为3
    diffNums: 3,
    //数据目录，优化选项
    dataDir: "/Users/tablee/workspaces/data",
    //选择存储类型，目前支持local和qiniu配置
    storageType: "local"
  },
  //邮件配置，注册模块验证邮箱需要使用 参考https://github.com/nodemailer/nodemailer
  smtpConfig:{
    host: "smtp.mxhichina.com",
    port: 465,
    secure: true,
    auth: {
      user: "",
      pass: ""
    }
  },
  //配置redis, 注册时需要， 登录限制密码出错次数
  redis: {
    default: {
      host: "127.0.0.1",
      port: 6379,
      retry_strategy: function (options) {
        if (options.error.code === 'ECONNREFUSED') {
          // End reconnecting on a specific error and flush all commands with a individual error
          return new Error('The server refused the connection');
        }
        if (options.total_retry_time > 1000 * 60 * 60) {
            // End reconnecting after a specific timeout and flush all commands with a individual error
            return new Error('Retry time exhausted');
        }
        if (options.times_connected > 10) {
            // End reconnecting with built in error
            return undefined;
        }
        // reconnect after
        return Math.max(options.attempt * 100, 3000);
      }
    }
  }
}
config.production = Object.assign({}, config.development);
module.exports = config;

var config = {};
config.development = {
  // Config for database, only support mysql.
  db: {
    username: "root",
    password: null,
    database: "codepush",
    host: "127.0.0.1",
    dialect: "mysql"
  },
  // Config for qiniu (http://www.qiniu.com/) cloud storage when storageType value is "qiniu".
  qiniu: {
    accessKey: "",
    secretKey: "",
    bucketName: "",
    downloadUrl: "" // Binary files download host address.
  },
  // Config for Amazon s3 (https://aws.amazon.com/cn/s3/) storage when storageType value is "s3".
  s3: {
    bucketName: process.env.BUCKET_NAME,
    region: process.env.REGION,
    downloadUrl: process.env.DOWNLOAD_URL, // binary files download host address.
  },
  // Config for local storage when storageType value is "local".
  local: {
    // Binary files storage dir, Do not use tmpdir and it's public download dir.
    storageDir: "/Users/tablee/workspaces/storage",
    // Binary files download host address which Code Push Server listen to. the files storage in storageDir.
    downloadUrl: "http://localhost:3000/download",
    // public static download spacename.
    public: '/download'
  },
  common: {
    // jwt sign secret for auth. you have to modify it for security. use random string instead it.
    loginSecret: "CodePushServer",
    /*
     * tryLoginTimes is control login error times to avoid force attack.
     * if value is 0, no limit for login auth, it may not safe for account. when it's a number, it means you can
     * try that times today. but it need config redis server.
     */
    tryLoginTimes: 0,
    // CodePush Web(https://github.com/lisong/code-push-web) login address.
    //codePushWebUrl: "http://localhost:3001/login",
    // create patch updates's number. default value is 3
    diffNums: 3,
    // data dir for caclulate diff files. it's optimization.
    dataDir: "/Users/tablee/workspaces/data",
    // storageType which is your binary package files store. options value is ("local" | "qiniu" | "s3")
    storageType: "local",
    // options value is (true | false), when it's true, it will cache updateCheck results in redis.
    updateCheckCache: false
  },
  //config for smtp email，register module need validate user email project source https://github.com/nodemailer/nodemailer
  smtpConfig:{
    host: "smtp.mxhichina.com",
    port: 465,
    secure: true,
    auth: {
      user: "",
      pass: ""
    }
  },
  //config for redis (register module, tryLoginTimes module)
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

# Config 解析

```json
{
  "development": {
    //数据库配置
    "db": {
      "username": "root",  
      "password": null,
      "database": "codepush",
      "host": "127.0.0.1",
      "dialect": "mysql" //目前只支持mysql
    },
    //七牛云存储配置 当storageType为qiniu时需要配置
    "qiniu": {
      "accessKey": "",
      "secretKey": "",
      "bucketName": "",
      "downloadUrl": "" //文件下载域名地址
    },
    //文件存储在本地配置 当storageType为local时需要配置
    "local": {
      "storageDir": "/Users/tablee/workspaces/storage", //文件存储目录
      //文件下载地址 CodePush Server 地址 + '/download' download对应app.js里面的地址
      "downloadUrl": "http://localhost:3000/download"  
    },
    "common": {
      "loginSecret": "CodePushServer", //登录jwt签名密钥，必须更改，否则有安全隐患，可以随机生成字符串
      "codePushWebUrl": "", //CodePush Web部署地址，也可以配置成CodePush Web登录地址
      "diffNums": 3, //差异化更新版本生成数目 默认为3
      "dataDir": "", //数据目录，优化选项
      "storageType": "local" //选择存储类型，目前支持local和qiniu配置
    },
    //邮件配置，注册模块验证邮箱需要使用 参考https://github.com/nodemailer/nodemailer
    "smtpConfig":{
      "host": "smtp.mxhichina.com",
      "port": 465,
      "secure": true, //http or https
      "auth": {
        "user": "Your Email Account",
        "pass": "Your Email Password"
      }
    }
  },
  "production": {
    // 生产环境 和 development类似
  }
}
```
# CodePush Server [source](https://github.com/lisong/code-push-server)

CodePush Server is a CodePush progam server! microsoft CodePush cloud is slow in China, we can use this to build our's. I use [qiniu](http://www.qiniu.com/) to store the files, because it's simple and quick!  Or you can use local storage, just modify config.js file, it's simple configure.

## 正确使用code-push热更新

- 苹果允许使用热更新[Apple's developer agreement](https://developer.apple.com/programs/ios/information/iOS_Program_Information_4_3_15.pdf), 但是规定不能弹框提示用户更新，影响用户体验。 而Google Play恰好相反，必须告知用户更新。然而中国的android市场都必须关闭更新弹框，否则会在审核应用时以“请上传最新版本的二进制应用包”驳回应用。
- react-native 不同平台bundle包不一样，在使用code-push-server的时候必须创建不同的应用来区分(eg. ios_CodePushDemo 和 android_CodePushDemo)
- react-native-code-push只更新资源文件,不会更新java和Objective C，所以npm升级依赖包版本的时候，如果依赖包使用的本地化实现, 这时候必须更改应用版本号(ios修改Info.plist中的CFBundleShortVersionString, android修改build.gradle中的versionName)
- 推荐使用code-push release-react 命令发布应用，该命令合并了打包和发布命令(eg. code-push release-react ios_CodePushDemo ios -d Production)

## EXAMPLE

### shell命令行端

```shell
$ code-push login http://codepush.19910225.com:8080 #登录
```

### [web](http://codepush-managerment.19910225.com:8080) 

访问：http://codepush-managerment.19910225.com:8080

### 客户端eg.

[CodePushDemo](https://github.com/lisong/code-push-demo-app)

## INSTALL

```shell
$ cd /path/to/code-push-server
$ mysql -uroot -e"create database codepush default charset utf8;"
$ mysql -uroot codepush < ./sql/codepush.sql
$ mysql -uroot codepush < ./sql/codepush-v0.1.1.sql
$ mysql -uroot codepush < ./sql/codepush-v0.1.5.sql
$ npm install
```

## CONFIG
```shell
$ vim config/config.js
```

read [config.js](https://github.com/lisong/code-push-server/blob/master/config/config.js)


## Storage mode [local/qiniu]

## RUN

```shell
$ node ./bin/www
```

or point config file and ENV

```shell
$ CONFIG_FILE=/path/to/config.js NODE_ENV=production node ./bin/www
```

notice. you have to change `loginSecret` in config.js for security.

## Default listen Host/Port  127.0.0.1/3000 
you can change like this.

```shell
$ PORT=3000 HOST=127.0.0.1 NODE_ENV=production node ./bin/www
```

## code-push-cli 
Use code-push-cli manager CodePushServer

```shell
$ npm install code-push-cli@lastest -g
$ code-push login http://127.0.0.1:3000 #login in browser account:admin password:123456
```

[code-push-cli source](https://github.com/Microsoft/code-push)

## react-native-code-push

```shell
$ cd /path/to/project
$ npm install react-native-code-push@lastest
```

## config react-native project
Follow the react-native-code-push docs, addition iOS add a new entry named CodePushServerURL, whose value is the key of ourself CodePushServer URL. Andriod use the new CodePush constructor in MainApplication point CodePushServerUrl

iOS eg. in file Info.plist

```xml
...
<key>CodePushDeploymentKey</key>
<string>YourCodePushKey</string>
<key>CodePushServerURL</key>
<string>YourCodePushServerUrl</string>
...
```

Android eg. in file MainApplication.java

```java
@Override
protected List<ReactPackage> getPackages() {
  return Arrays.<ReactPackage>asList(
      new MainReactPackage(),
      new CodePush(
         "YourKey",
         MainApplication.this,
         BuildConfig.DEBUG,
         "YourCodePushServerUrl" 
      )
  );
}
```

[react-native-code-push source](https://github.com/Microsoft/react-native-code-push)


## Production Manage
use [pm2](http://pm2.keymetrics.io/) to manage process.

```shell
$ npm install pm2 -g
$ cp config/config.js /path/to/production/config.js
$ vim /path/to/production/config.js #configure your env.
$ cp docs/process.yml /path/to/production/process.yml
$ vim /path/to/production/process.yml #configure your env.
$ pm2 start /path/to/production/process.yml
```

## Use [CodePush Web](https://github.com/lisong/code-push-web) manage apps

add codePushWebUrl config in ./config/config.js

eg.

```json
...
"common": {
  "loginSecret": "CodePushServer",
  "codePushWebUrl": "Your CodePush Web address",
}
...
```

## License
MIT License [read](https://github.com/lisong/code-push-server/blob/master/LICENSE)



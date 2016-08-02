# CodePushServer

CodePushServer is a CodePush progam server! microsoft CodePush cloud is slow in China, we can use this to build our's cloud server. I use [qiniu](http://www.qiniu.com/) to store the files, because of it simple and quick! Just thanks microsoft

## INSTALL

```shell
$ cd /path/to/code-push-server
$ mysql -uroot -e"create database codepush default charset utf8;"
$ mysql -uroot codepush < ./codepush.sql
$ npm install
```

## CONFIG
```shell
$ vim config/config.json
```

## RUN

```shell
$ node ./bin/www
```

or point config file and ENV

```shell
$ CONFIG_FILE=/path/to/config.json NODE_ENV=production node ./bin/www
```

## code-push-cli 
Use code-push-cli manager CodePushServer

```shell
$ npm i code-push-cli@lastest -g
$ code-push login http://127.0.0.1:3000 #login in browser account:admin password:123456
```

[code-push-cli source](https://github.com/Microsoft/code-push)

## react-native-code-push

```shell
npm i react-native-code-push@lastest -g
```

## config react-native project
Follow the react-native-code-push docs, addition iOS add a new entry named CodePushServerURL, whose value is the key of ourself CodePushServer URL. Andriod change com.microsoft.codepush.react.CodePush serverUrl to ourself.

[react-native-code-push source](https://github.com/Microsoft/react-native-code-push)



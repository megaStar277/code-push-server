# CodePush Server ![Node.js CI](https://github.com/shm-open/code-push-server/workflows/Node.js%20CI/badge.svg)

[[Chinese version 中文版]](./README.cn.md)

CodePush Server is a CodePush program server. The official Microsoft CodePush service is slow in China, therefore we use this to host our own server.

## About this fork

Since the original [code-push-server](https://github.com/lisong/code-push-server) project is not actively maintained, we created this fork to:

-   keep dependencies up-to-date
-   fix any compatiblity issue with latest official code-push clients
-   we only stick to official react-native-code-push client, therefore the customized feature like [is_use_diff_text](https://github.com/lisong/code-push-server#advance-feature) won't be supported.
-   we only use react-native-code-push client in production, most of the feature should be no difference for the rest CodePush clients, but if you found any, issues and PRs are always welcome.

## Support Storage mode

-   local: store bundle files in local machine
-   qiniu: store bundle files in [qiniu](http://www.qiniu.com/)
-   s3: store bundle files in [aws](https://aws.amazon.com/)
-   oss: store bundle files in [aliyun](https://www.aliyun.com/product/oss)
-   tencentcloud: store bundle files in [tencentcloud](https://cloud.tencent.com/product/cos)

## 正确使用 code-push 热更新

-   苹果 App 允许使用热更新[Apple's developer agreement](https://developer.apple.com/programs/ios/information/iOS_Program_Information_4_3_15.pdf), 为了不影响用户体验，规定必须使用静默更新。 Google Play 不能使用静默更新，必须弹框告知用户 App 有更新。中国的 android 市场必须采用静默更新（如果弹框提示，App 会被“请上传最新版本的二进制应用包”原因驳回）。
-   react-native 不同平台 bundle 包不一样，在使用 code-push-server 的时候必须创建不同的应用来区分(eg. CodePushDemo-ios 和 CodePushDemo-android)
-   react-native-code-push 只更新资源文件,不会更新 java 和 Objective C，所以 npm 升级依赖包版本的时候，如果依赖包使用的本地化实现, 这时候必须更改应用版本号(ios 修改 Info.plist 中的 CFBundleShortVersionString, android 修改 build.gradle 中的 versionName), 然后重新编译 app 发布到应用商店。
-   推荐使用 code-push release-react 命令发布应用，该命令合并了打包和发布命令(eg. code-push release-react CodePushDemo-ios ios -d Production)
-   每次向 App Store 提交新的版本时，也应该基于该提交版本同时向 code-push-server 发布一个初始版本。(因为后面每次向 code-push-server 发布版本时，code-puse-server 都会和初始版本比较，生成补丁版本)

### CodePush Cli

check out the [code-push-cli](https://github.com/shm-open/code-push-cli) which works with server for manage apps and publish releases

### Clients

-   [React Native](https://github.com/Microsoft/react-native-code-push)
-   [Cordova](https://github.com/microsoft/cordova-plugin-code-push)
-   [Capacitor](https://github.com/mapiacompany/capacitor-codepush)

## How To Install code-push-server

-   [docker](./docs/install-server-by-docker.md) (recommended)
-   [manual operation](./docs/install-server.md)

## Default Account and Password

-   account: `admin`
-   password: `123456`

## FAQ

-   [modify password](https://github.com/lisong/code-push-server/issues/43)
-   [code-push-server normal solution (CN)](https://github.com/lisong/code-push-server/issues/135)
-   targetBinaryVersion support
    -   `*`
    -   `1.2.3`
    -   `1.2`/`1.2.*`
    -   `1.2.3 - 1.2.7`
    -   `>=1.2.3 <1.2.7`
    -   `~1.2.3`
    -   `^1.2.3`

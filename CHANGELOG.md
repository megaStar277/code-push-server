# Changelog

All notable changes to this project will be documented in this file. See [standard-version](https://github.com/conventional-changelog/standard-version) for commit guidelines.

### [1.0.1](https://github.com/shm-open/code-push-server/compare/v1.0.0...v1.0.1) (2021-08-19)


### Bug Fixes

* **deps:** pin dependencies ([1822c0f](https://github.com/shm-open/code-push-server/commit/1822c0f99adee270a15f343275316a5de725a0f3))
* **deps:** update dependency cos-nodejs-sdk-v5 to v2.10.0 ([9a65b0f](https://github.com/shm-open/code-push-server/commit/9a65b0faf51761178c16c46772ab80a92ee8c068))
* **deps:** update dependency express to v4.17.1 ([1f4c7c1](https://github.com/shm-open/code-push-server/commit/1f4c7c11cf31f85b84c6209851fb96981d81129c))
* **deps:** update mysql2 and setup github action ci ([6ab24d3](https://github.com/shm-open/code-push-server/commit/6ab24d336ce37e4a1522e21cf027096c3467a7a1))
* return appVersion as target_binary_range to compatible with code-push 3.0.1 changes ([40b41fb](https://github.com/shm-open/code-push-server/commit/40b41fbc20ad35393d097336570a72d1eef16906))

# Changelog for code-push-server

## 0.5.x

## 新特性
- 针对文本增量更新进行优化，使用google `diff-match-patch` 算法计算差异
   - react-native-code-push Android客户端适配,需要合并https://github.com/Microsoft/react-native-code-push/pull/1393, 才能正常使用文本增量更新功能。
  - react-native-code-push iOS客户端适配 (需要合并https://github.com/Microsoft/react-native-code-push/pull/1399)
  - react-native-code-push Windows客户端适配 (进行中)

## fixbug

- 修复统计数据激活数
- 修复灰度发布bug
- rollback后增加计算和最后一次增量更新版本

## 如何升级到该版本

###  升级数据库

`$ npm run upgrade`

or

`$ code-push-server-db upgrade`


## 0.4.x

### 新特性

- targetBinaryVersion 支持正则匹配, `deployments_versions`新增字段`min_version`,`max_version`
  - `*` 匹配所有版本
  - `1.2.3` 匹配特定版本`1.2.3`
  - `1.2`/`1.2.*` 匹配所有1.2补丁版本 
  - `>=1.2.3<1.3.7`
  - `~1.2.3` 匹配`>=1.2.3<1.3.0`
  - `^1.2.3` 匹配`>=1.2.3<2.0.0`
- 添加docker编排服务部署，更新文档
- Support Tencent cloud cos storageType  

## 如何升级到该版本

-  升级数据库
`$ ./bin/db upgrade`
or
`$ mysql codepush < ./sql/codepush-v0.4.0-patch.sql`

- 处理存量数据
``` shell
   $ git clone https://github.com/lisong/tools
   $ cd tools
   $ npm i
   $ vim ./bin/fixMinMaxVersion //修改数据配置
   $ node  ./bin/fixMinMaxVersion //出现提示 success
```

## 0.3.x

- 支持灰度发布
- 适配`code-push app add` 命令，应用不再以名字区分平台，而是以类型区分平台
  - 数据库表apps新增字段`os`,`platform`
- 完善`code-push release/release-react/release-cordova` 命令
  - 数据库表packages新增`is_disabled`,`rollout`字段
- 适配`code-push patch`命令
- 新增`log_report_download`,`log_report_deploy`日志表
- 升级npm依赖包

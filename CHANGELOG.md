# Changelog for code-push-server
## 0.4.7

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

## 0.3.0

- 支持灰度发布
- 适配`code-push app add` 命令，应用不再以名字区分平台，而是以类型区分平台
  - 数据库表apps新增字段`os`,`platform`
- 完善`code-push release/release-react/release-cordova` 命令
  - 数据库表packages新增`is_disabled`,`rollout`字段
- 适配`code-push patch`命令
- 新增`log_report_download`,`log_report_deploy`日志表
- 升级npm依赖包

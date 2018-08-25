# docker 部署 code-push-server

>该文档用于描述docker部署code-push-server，实例包含三个部分

- code-push-server部分
  - 更新包默认采用`local`存储(即存储在本地机器上)。使用docker volume存储方式，容器销毁不会导致数据丢失，除非人为删除volume。
  - 默认开启5个实例，使用swarn内部默认负载均衡策略，可以根据自己机器设置docker-compose.yml文件中deploy参数。
  - docker-compose.yml只提供了应用部分参数设置，如需要其他特定配置，可以修改文件config.js。
- mysql部分
  - 数据使用docker volume存储方式，容器销毁不会导致数据丢失，除非人为删除volume。
  - 默认应用使用root用户，为了安全可以创建权限相对较小的权限供code-push-server使用
- redis部分
  - `tryLoginTimes` 登录错误次数限制
  - `updateCheckCache` 提升应用性能提升 
  - `updateCheckCache` 灰度发布 

## 安装docker

参考docker官方安装教程

- [>>mac点这里](https://docs.docker.com/docker-for-mac/install/)
- [>>windows点这里](https://docs.docker.com/docker-for-windows/install/)
- linux基本都自带，但是需要启动，如果版本太老，请更新到最新稳定版


`$ docker info` 能成功输出相关信息，则安装成功，才能继续下面步骤

## 启动swarm

```bash
$ docker swarm init
```


## 获取代码

```bash
$ git clone https://github.com/lisong/code-push-server.git
$ cd code-push-server/docker
```

## 修改配置文件

```bash
$ vim docker-compose.yml
```

*将`DOWNLOAD_URL`中`YOU_MACHINE_IP`替换成本机ip*
*将`MYSQL_HOST`中`YOU_MACHINE_IP`替换成本机ip*

## jwt.tokenSecret修改

> code-push-server 验证登录验证方式使用的json web token加密方式,该对称加密算法是公开的，所以修改config.js中tokenSecret值很重要。

* 非常重要！非常重要！ 非常重要！*

> 可以打开连接`https://www.grc.com/passwords.htm`获取 `63 random alpha-numeric characters`类型的随机生成数作为密钥

## 部署

```
$ docker stack deploy -c docker-compose.yml code-push-server
```

> 如果网速不佳，需要漫长而耐心的等待。。。去和妹子聊会天吧^_^


## 查看进展

```
$ docker service ls
$ docker service ps code-push-server_db
$ docker service ps code-push-server_redis
$ docker service ps code-push-server_server
```

> 确认`CURRENT STATE` 为 `Running about ...`, 则已经部署完成

## 访问接口简单验证

`$ curl -I http://127.0.0.1:3000/`

返回`200 OK`

```http
HTTP/1.1 200 OK
X-DNS-Prefetch-Control: off
X-Frame-Options: SAMEORIGIN
Strict-Transport-Security: max-age=15552000; includeSubDomains
X-Download-Options: noopen
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
Content-Type: text/html; charset=utf-8
Content-Length: 592
ETag: W/"250-IiCMcM1ZUFSswSYCU0KeFYFEMO8"
Date: Sat, 25 Aug 2018 15:45:46 GMT
Connection: keep-alive
```

## 查看服务日志

```shell
$ docker service logs code-push-server_server
$ docker service logs code-push-server_db
$ docker service logs code-push-server_redis
```

## 查看存储 `docker volume ls`

DRIVER | VOLUME NAME |  描述    
------ | ----- | -------
local  | code-push-server_data-mysql | 数据库存储数据目录
local  | code-push-server_data-storage | 存储打包文件目录
local  | code-push-server_data-tmp | 用于计算更新包差异文件临时目录

## 销毁退出应用

```bash
$ docker stack rm code-push-server
```

---
title: Docker 容器间通信
date: 2021-01-27 10:55:38 GMT+0800
categories: [Dev-Ops]
tags: [Docker]
---

::: tip
经常会遇到容器间通信，比如前端容器将请求转发到后端容器，后端容器请求数据库等容器。
:::

<!-- more -->

## 容器内使用`nc`命令测试连接

```
$ docker run --rm -it alpine sh
$ nc www.baidu.com 80
hello
HTTP/1.1 400 Bad Request

$ nc mysql 3306
nc: bad address 'mysql'
```

::: tip

- alpine 镜像直接内置了`nc`命令，相当方便
- 现在不能直接获取 mysql 容器的 IP

:::

## `--network`

只有在同一网络内，才可以通过 Docker 的 DNS 用容器 Name 得到容器 IP（被连接的容器不需要向宿主机暴露端口）。

```sh
$ docker network ls
NETWORK ID     NAME               DRIVER    SCOPE
9b539e51a804   bridge             bridge    local
e6356e59ab55   host               host      local
ef76aa961a31   mysql_default      bridge    local
387d468c8af0   none               null      local
$ docker run --rm -it --net mysql_default alpine sh
$ nc mysql 3306
J
8.0.23
      c?~Th?????/n%,Dp;pmysql_native_password^Cpunt!
```

::: warning
docker run 的`--link`参数将在未来被弃用。
:::

## `docker-compose`

docker-compose 创建的容器服务会自动生成一个`**_default`网络并加入。如果需要加入其他的容器网络，：

```yml
version: '3.5'

services:
  backend:
    build: ./backend
    environment:
      - DB_HOST=mysql
    networks:
      - mysql_default
      - default
  frontend:
    image: frontend:latest
    networks:
      - default

networks:
  mysql_default:
    external: true
```

::: warning

- Docker DNS 的是容器 Name，而不是网络名。
- 如果某个容器要加入其他网络，需要显式添加 default 网络，不然是不会自动加入的，也意味着同一 dockerfile 内的其他容器不能通过 docker DNS 的方式访问该容器。

:::

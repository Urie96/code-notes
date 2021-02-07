---
title: Bypass Magic Firewall
date: 2021-02-04 11:07:30 GMT+0800
categories: [Other]
tags: [Linux]
---

::: tip
由于某种神奇之力，许多国外网站无法登录，比如 Google 搜索不能访问、Google 扩展商店不能进入、Golang 官方包不能下载、Kubernetes 不能安装。所以选择搭建 SSR 解决这个问题。
:::

<!-- more -->

## 服务端

// TODO

## 客户端

### Linux

先把 Python 安装好，之后安装 SSR 客户端 shadowsocksr：

```sh
$ git clone -b manyuser https://hub.fastgit.org/shadowsocksrr/shadowsocksr.git
$ cd shadowsocksr
$ vi config.json # 根据服务器的配置来配置
$ python ./shadowsocks/local.py -d start --pid-file=./ssr.pid --log-file=./ssr.log # 启动
$ python ./shadowsocks/local.py -d stop --pid-file=./ssr.pid --log-file=./ssr.log # 停止
```

::: tip
shadowsocksr 使用 socks5 协议，和直接设置 http_proxy 或者 https_proxy 是不一样的，可以通过`nc -l 1080`发现。
:::

所以还需要安装使用 socks5 代理的程序：

::: tip
貌似 Ubuntu 可以直接`apt-get install proxychains4`
:::

```sh
git clone https://hub.fastgit.org/rofl0r/proxychains-ng.git
cd proxychains-ng
./configure --prefix=/usr --sysconfdir=/etc
make && make install
make install-config
echo 'socks5 127.0.0.1 1080' >> /etc/proxychains4.conf # 这里可能需要手动改下
echo 'alias p="proxychains4"' >> ~/.bash_profile
source ~/.bash_profile
```

::: tip Usage
在命令前面加`p`
:::

## 测试

```sh
$ curl www.httpbin.org/ip
{
  "origin": "59.110.71.167"
}
$ p curl www.httpbin.org/ip
[proxychains] config file found: /etc/proxychains.conf
[proxychains] preloading /usr/lib/libproxychains4.so
[proxychains] DLL init: proxychains-ng 4.14-git-36-g6c029fd
[proxychains] Strict chain  ...  127.0.0.1:1080  ...  www.httpbin.org:80  ...  OK
{
  "origin": "45.76.166.42"
}
```

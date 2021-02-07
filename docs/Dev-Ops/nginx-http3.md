---
title: 在Nginx中开启HTTP/3
date: 2021-02-01 15:47:44 GMT+0800
categories: [Dev-Ops]
tags: []
---

::: tip
HTTP/3 目前还处于试验性阶段，只能使用 nginx 单独的 quic 分支进行编译，还需要安装 Google 自己的 SSL 协议 boringssl，这个 SSL 才内置了谷歌的 QUIC 协议。
:::

<!-- more -->

## 安装

```sh
# 依赖
yum install make cmake3 automake gcc gcc-c++ kernel-devel hg
# 安装boringssl需要的golang
wget https://golang.google.cn/dl/go1.15.7.linux-amd64.tar.gz
tar xf ./go1.15.7.linux-amd64.tar.gz
rm -f ./go1.15.7.linux-amd64.tar.gz
ln -s $PWD/go/bin/go /usr/loal/bin/go
go env -w GO111MODULE=on
go env -w GOPROXY=https://goproxy.cn,direct # 或者在墙外
# 编译brotli
git clone --depth=1 https://github.com/google/boringssl.git # https://hub.fastgit.org/google/boringssl.git 如果慢可以使用这个镜像
mkdir build
cd build
cmake3 ..
make
cd ..
# 编译nginx
hg clone -b quic https://hg.nginx.org/nginx-quic
cd nginx-quic
./auto/configure \
  --with-http_v3_module \
  --with-cc-opt="-I../boringssl/include" \
  --with-ld-opt="-L../boringssl/build/ssl -L../boringssl/build/crypto" \
  --with-http_quic_module \
  --sbin-path=/usr/sbin/nginx \
  --conf-path=/etc/nginx/nginx.conf \
  --add-module=../ngx_brotli \
  --with-http_v2_module \
  --with-http_gzip_static_module \
  --with-http_ssl_module
make -j$(getconf _NPROCESSORS_ONLN)
make install
nginx -V
```

::: warning
像这种开发中的分支，一定要用版本管理工具 clone 才是最新的，不要用官方打包的 gz 文件！！！
我用官方 gz 包编译的 nginx，如果客户端使用 HTTP/3，nginx 将请求转发到后端会在 HTTP body 的前面多加错误的字符。耽误了好多时间来发现错误，结果发现最近已经修复了，只是没有发布 gz。。。
:::

## 配置

### Nginx 配置

```
server {
    listen       443 ssl http2;
    listen       443 http3 reuseport;

    ssl_protocols       TLSv1 TLSv1.1 TLSv1.2 TLSv1.3;
    ...

    ssl_early_data on;
    add_header Alt-Svc '$http3=":443"; ma=86400';

    location / {
        brotli_static on;
        gzip_static on;
        root  /root/hackbook/front-end/dist;
        try_files $uri $uri/ /index.html;
    }
}
```

::: tip

- 两个 listen，一个监听 TCP 的 443，一个监听 UDP 的 443，保持服务多个 HTTP 版本
- `ssl_early_data on;`：开启 0-RTT，使后续连接的第一个数据包可以携带有效数据
- `add_header Alt-Svc '$http3=":443"; ma=86400'`：会添加响应头部`alt-svc: h3-29=":443"; ma=86400`，告知浏览器可以支持 HTTP/3
- `ssl_protocols`一定要包含`TLSv1.3`，这是 QUIC 需要的

:::

### 浏览器配置

#### Chrome 83+

通过命令行参数启动 Chrome：

```
./chrome --enable-quic --quic-version=h3-29
```

#### Firefox 75+

导航栏输入`about:config`，将`network.http.http3.enabled`置为 true

::: warning
有时候浏览器打开久了，即使开启了也不会使用 HTTP/3，貌似因为缓存的原因，需要彻底退出重进就好了。
:::

## 测试

这里使用 Firefox 审查网络，很奇怪的是首次打开页面会有 HTTP/2，在握手的时候浏览器应该能知道服务器支持 HTTP/3 的。而且即使`/`页面返回了，后续请求还存在 HTTP/2。

首次打开页面：

![first](https://cdn.jsdelivr.net/gh/Urie96/images/screenshot-http3-first.png)

不过后续打开页面都是 HTTP/3 了：

![second](https://cdn.jsdelivr.net/gh/Urie96/images/screenshot-http3-second.png)

::: tip
对比前后两次请求能够注意到 HTTP/3 的协议传输比 HTTP/2 的协议传输小 0.02KB
:::

还可以使用 [https://www.http3check.net/about](https://www.http3check.net/about) 测试目标网站是否成功开启 HTTP/3 或者 QUIC。

---
title: Nginx 使用 Brotli 提升网站速度
date: 2021-01-14 13:26:07 GMT+0800
categories: [Dev-Ops]
tags: [Linux]
---

## 介绍

Brotli 是谷歌开源的压缩算法，比 gzip 的压缩率要好，已经被许多浏览器支持。在生产环境中可以同时开启 brotli 或者 gzip，这样即使浏览器不支持 brotli 也可以响应 gzip 内容。

## 安装 Brotli 的 Nginx 的 Alpine 镜像的 Dockerfile

nginx 官方没有提供 brotli 模块，只能在编译 nginx 时带上谷歌开源的 [ngx_brotli](https://github.com/google/ngx_brotli)，或者通过 nginx 的动态模块加载。当然，nginx 的官方镜像也没有 brotli 模块，第三方的 docker 镜像也大多是臃肿的 ubuntu 镜像。下面是加载好 brotli 的 alpine 镜像：

```dockerfile
FROM alpine:3.12.3

LABEL maintainer "By Urie96 - https://github.com/Urie96"

ENV NGINX_VERSION 1.19.6

RUN set -ex \
  && apk add --no-cache \
  ca-certificates libressl pcre zlib \
  && apk add --no-cache --virtual .build-deps \
  build-base autoconf automake libtool linux-headers libressl-dev pcre-dev zlib-dev git \
  && cd /tmp \
  && wget http://nginx.org/download/nginx-${NGINX_VERSION}.tar.gz \
  && tar xf nginx-${NGINX_VERSION}.tar.gz \
  && git clone https://github.com/google/ngx_brotli.git \
  && cd ngx_brotli \
  && git submodule update --init \
  && cd /tmp \
  && cd nginx-${NGINX_VERSION} \
  && ./configure \
  --sbin-path=/usr/sbin/nginx \
  --conf-path=/etc/nginx/nginx.conf \
  --add-module=/tmp/ngx_brotli \
  --with-http_v2_module \
  --with-http_gzip_static_module \
  --with-http_ssl_module \
  && make -j$(getconf _NPROCESSORS_ONLN) \
  && make install \
  && apk del .build-deps \
  && rm -rf /tmp/*

EXPOSE 80 443

CMD ["nginx","-g","daemon off;"]
```

## Nginx Brotli Config

Nginx 服务预压缩的文件，如果请求头中的`accept-encoding`字段不含有`br`，则可以响应预压缩的 gzip 文件。

```nginx
brotli_static on;
gzip_static on;
```

Nginx 动态压缩，如果请求头中的`accept-encoding`字段不含有`br`，则可以响应动态压缩的 gzip 内容。

```nginx
brotli on;
brotli_types application/json;
brotli_min_length 10240;
brotli_comp_level 6;
gzip on;
gzip_proxied any;
gzip_types application/json;
gzip_min_length 10240;
```

## Node 预压缩静态文件

```js
const fs = require('fs');
const glob = require('glob');
const brotli = require('brotli');
const chalk = require('chalk');
const zlib = require('zlib');

const pattern = './dist/**/*.{js,css,json,svg,html}';
const threshold = 1024 * 5;

function printProfitInfo(filePath, inBytes, outBytes) {
  var profitPercents = 100 - (outBytes * 100) / inBytes;
  console.log(
    chalk.blue(filePath) +
      ' : ' +
      Math.round((inBytes / 1024) * 1000) / 1000 +
      ' KiB' +
      (profitPercents < 0 ? ' + ' : ' - ') +
      chalk.green(Math.abs(Math.round(profitPercents * 10) / 10) + '%') +
      ' = ' +
      Math.round((outBytes / 1024) * 1000) / 1000 +
      ' KiB'
  );
}

glob(pattern, (err, files) => {
  files.forEach((file) => {
    fs.readFile(file, (err, src) => {
      if (src.length > threshold) {
        const brFileName = file + '.br';
        const gzFileName = file + '.gz';
        const brzip = brotli.compress(src, { mode: 1 });
        const gzip = zlib.gzipSync(src);
        printProfitInfo(brFileName, src.length, brzip.length);
        printProfitInfo(gzFileName, src.length, gzip.length);
        fs.writeFile(brFileName, brzip, () => {});
        fs.writeFile(gzFileName, gzip, () => {});
      }
    });
  });
});
```

测试：

```js
// ./dist/assets/index.3360fe5d.css.br : 13.991 KiB - 75.8% = 3.38 KiB
// ./dist/assets/index.3360fe5d.css.gz : 13.991 KiB - 72.5% = 3.846 KiB
// ./dist/assets/index.4ffd98be.js.br : 188.269 KiB - 69.1% = 58.254 KiB
// ./dist/assets/index.4ffd98be.js.gz : 188.269 KiB - 64.7% = 66.458 KiB
// ./dist/favicon.svg.br : 7.396 KiB - 68.4% = 2.335 KiB
// ./dist/favicon.svg.gz : 7.396 KiB - 63.8% = 2.676 KiB
// ./dist/workbox-f7373732.js.br : 14.485 KiB - 68.5% = 4.558 KiB
// ./dist/workbox-f7373732.js.gz : 14.485 KiB - 65.1% = 5.059 KiB
```

## 测试

### 服务预压缩文件

#### 请求头携带`br`

```http
GET https://book.sweetlove.top/assets/index.4ffd98be.js HTTP/1.1
User-Agent: vscode-restclient
accept-encoding: gzip, deflate, br


HTTP/1.1 200 OK
Server: nginx/1.19.6
Date: Sun, 17 Jan 2021 02:37:18 GMT
Content-Type: application/javascript
Content-Length: 59652
Last-Modified: Thu, 14 Jan 2021 08:48:58 GMT
Connection: close
ETag: "6000057a-e904"
Content-Encoding: br
```

#### 请求头不携带`br`

```http
GET https://book.sweetlove.top/assets/index.4ffd98be.js HTTP/1.1
User-Agent: vscode-restclient
accept-encoding: gzip, deflate


HTTP/1.1 200 OK
Server: nginx/1.19.6
Date: Sun, 17 Jan 2021 02:43:35 GMT
Content-Type: application/javascript
Content-Length: 68053
Last-Modified: Thu, 14 Jan 2021 08:48:58 GMT
Connection: close
ETag: "6000057a-109d5"
Content-Encoding: gzip
```

### 动态压缩

#### 请求头携带`br`

```http
GET https://book.sweetlove.top/api/courses HTTP/1.1
User-Agent: vscode-restclient
accept-encoding: gzip, deflate, br


HTTP/1.1 200 OK
Server: nginx/1.19.6
Date: Sun, 17 Jan 2021 02:55:12 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: close
X-Powered-By: Express
X-Content-Type-Options: nosniff
ETag: W/"10457-9r+f/6n4HcgjHf8CPAm1c9ln8z8"
Content-Encoding: br
```

#### 请求头不携带`br`

```http
GET https://book.sweetlove.top/api/courses HTTP/1.1
User-Agent: vscode-restclient
accept-encoding: gzip, deflate


HTTP/1.1 200 OK
Server: nginx/1.19.6
Date: Sun, 17 Jan 2021 02:52:12 GMT
Content-Type: application/json; charset=utf-8
Transfer-Encoding: chunked
Connection: close
X-Powered-By: Express
X-Content-Type-Options: nosniff
ETag: W/"10457-9r+f/6n4HcgjHf8CPAm1c9ln8z8"
Content-Encoding: gzip
```

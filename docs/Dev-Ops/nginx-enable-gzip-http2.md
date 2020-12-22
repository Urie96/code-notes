---
title: Nginx 开启 Gzip 与 HTTP2
date: 2020-11-30
categories: [Dev-Ops]
tags: [Nginx]
---

## Installation

See [official documentation](http://nginx.org/en/download.html).

```bash
$ wget http://nginx.org/download/nginx-1.19.5.tar.gz
$ tar xf nginx-1.19.5.tar.gz
$ cd nginx-1.19.5
$ ./configure --with-http_v2_module --with-http_gzip_static_module --with-http_ssl_module
$ make
$ make install
$ cd where bin is
$ ln -s $(pwd)/nginx /usr/local/bin/nginx
```

## Command

See [official documentation](http://nginx.org/en/docs/switches.html).

```sh
$ nginx # boot
$ nginx -s reload
$ nginx -s stop
$ nginx -V # check version and modules installed
```

## Enable https SSL HTTP/2

See [official documentation](http://nginx.org/en/docs/http/ngx_http_v2_module.html).

### 1. Install nginx module

```bash
$ cd where install package is
$ ./configure --with-http_ssl_module --with-http_v2_module
```

### 2. Update config

update `server` in `default.conf`, please note `ssl_ciphers`[^ssl_ciphers]

[^ssl_ciphers]: 如果没有这项，Chrome 会报错 `ERR_HTTP2_INADEQUATE_TRANSPORT_SECURITY`，表示协议安全性不足

```
listen              443 ssl http2;
server_name         sso.*;
keepalive_timeout   70;
ssl_protocols       TLSv1 TLSv1.1 TLSv1.2;
ssl_ciphers         "EECDH+AESGCM:EDH+AESGCM:ECDHE-RSA-AES128-GCM-SHA256:AES256+EECDH:DHE-RSA-AES128-GCM-SHA256:AES256+EDH:ECDHE-RSA-AES256-GCM-SHA384:DHE-RSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-SHA384:ECDHE-RSA-AES128-SHA256:ECDHE-RSA-AES256-SHA:ECDHE-RSA-AES128-SHA:DHE-RSA-AES256-SHA256:DHE-RSA-AES128-SHA256:DHE-RSA-AES256-SHA:DHE-RSA-AES128-SHA:ECDHE-RSA-DES-CBC3-SHA:EDH-RSA-DES-CBC3-SHA:AES256-GCM-SHA384:AES128-GCM-SHA256:AES256-SHA256:AES128-SHA256:AES256-SHA:AES128-SHA:DES-CBC3-SHA:HIGH:!aNULL:!eNULL:!EXPORT:!DES:!MD5:!PSK:!RC4";
ssl_certificate     /root/nginx/cert/4740775_sso.sweetlove.top.pem;
ssl_certificate_key /root/nginx/cert/4740775_sso.sweetlove.top.key;
ssl_session_cache   shared:SSL:10m;
ssl_session_timeout 10m;
```

## Enable Gzip

To compress HTTP response.

### Dynamic Gzip

See [official documentation](http://nginx.org/en/docs/http/ngx_http_gzip_module.html).  
Gzip module is installed by default. Update `server` in `default.conf`.

```
gzip              on;
gzip_http_version 1.0;
gzip_proxied      any;
gzip_types        application/json;
gzip_min_length   10240;
```

::: tip Note
**gzip_http_version**: 如果使用两次 Nginx 转发，第一次转发时 Nginx 会使用 `HTTP/1.0` 代理转发，而动态 gzip 默认是高于`HTTP/1.1`才会开启，所以需要配置为 1.0 就开启。
:::

### Static Gzip

See [official documentation](http://nginx.org/en/docs/http/ngx_http_gzip_static_module.html).  
Run `./configure --with-http_gzip_static_module && make`to install gzip static module, and update `server` in `default.conf`.

```
gzip_static       on;
gzip_http_version 1.0;
```

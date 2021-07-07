---
title: Kubernetes(二)：本地搭建Docker私有仓库
date: 2021-07-01 16:35:19 GMT+0800
categories: [Kubernetes]
tags: [Kubernetes, Linux]
---

::: tip
为了能将本地构建的镜像分发到各个虚拟机，比较优雅的方式是使用 Docker registry，如果是用官网的 DockerHub，本地调试都需要将镜像推送到远程，一来一回耗费需要 4 倍镜像大小的流量。所以本节通过在宿主机上搭建私有仓库，让虚拟机可以直接拉取镜像，不走公网。
:::

<!-- more -->

## registry 镜像

本地测试非常顺利：

```zsh
$ docker run -d --rm -p 5000:5000 registry
Unable to find image 'registry:latest' locally
latest: Pulling from library/registry
ddad3d7c1e96: Pull complete
6eda6749503f: Pull complete
363ab70c2143: Pull complete
5b94580856e6: Pull complete
12008541203a: Pull complete
Digest: sha256:aba2bfe9f0cff1ac0618ec4a54bfefb2e685bbac67c8ebaf3b6405929b3e616f
Status: Downloaded newer image for registry:latest
f01084002851f560174e041be6ee8d96bfd78c47ccd3d29ae9e7a41e63274f29
$ docker pull busybox
$ docker tag busybox localhost:5000/busybox
$ docker push localhost:5000/busybox: latest
The push refers to repository [localhost:5000/busybox]
5b8c72934dfc: Pushed
latest: digest: sha256:dca71257cd2e72840a21f0323234bb2e33fea6d949fa0f21c5102146f583486b size: 527
$ docker rmi localhost:5000/busybox
Untagged: localhost:5000/busybox:latest
Untagged: localhost:5000/busybox@sha256:dca71257cd2e72840a21f0323234bb2e33fea6d949fa0f21c5102146f583486b
$ docker pull localhost:5000/busybox:latest
latest: Pulling from busybox
Digest: sha256:dca71257cd2e72840a21f0323234bb2e33fea6d949fa0f21c5102146f583486b
Status: Downloaded newer image for localhost:5000/busybox:latest
localhost:5000/busybox:latest
```

如果不用`localhost`而是使用本机 IP`10.79.40.213`就会出错，因为 Docker 只有在使用 localhost 的时候才用 HTTP，外部 IP 会使用 HTTPS，而 registry 没有配置 HTTPS：

```zsh
$ docker tag busybox 10.79.40.213:5000/busybox
$ docker push 10.79.40.213:5000/busybox:latest
The push refers to repository [10.79.40.213:5000/busybox]
Get https://10.79.40.213:5000/v2/: http: server gave HTTP response to HTTPS client
$ docker pull 10.79.40.213:5000/busybox:latest
Error response from daemon: Get https://10.79.40.213:5000/v2/: http: server gave HTTP response to HTTPS client
```

## 自签名证书

可以通过`openssl`创建自签名证书，但配置有点复杂，所以使用这个[项目](https://github.com/Fishdrowned/ssl)，它是对`openssl`的封装（但是需要在 Linux 下运行，Mac 上失败了）。

```zsh
$ git clone https://github.com/Fishdrowned/ssl.git
Cloning into 'ssl'...
remote: Enumerating objects: 112, done.
remote: Total 112 (delta 0), reused 0 (delta 0), pack-reused 112
Receiving objects: 100% (112/112), 173.19 KiB | 247.00 KiB/s, done.
Resolving deltas: 100% (51/51), done.
$ cd ssl && ./gen.cert.sh devbox
...
Certificates are located in:
lrwxrwxrwx 1 yangrui.0 yangrui.0 33 Jul  1 18:24 /home/yangrui.0/workplace/ssl/temp/ssl/out/devbox/devbox.bundle.crt -> ./20210701-1824/devbox.bundle.crt
lrwxrwxrwx 1 yangrui.0 yangrui.0 26 Jul  1 18:24 /home/yangrui.0/workplace/ssl/temp/ssl/out/devbox/devbox.crt -> ./20210701-1824/devbox.crt
lrwxrwxrwx 1 yangrui.0 yangrui.0 15 Jul  1 18:24 /home/yangrui.0/workplace/ssl/temp/ssl/out/devbox/devbox.key.pem -> ../cert.key.pem
lrwxrwxrwx 1 yangrui.0 yangrui.0 11 Jul  1 18:24 /home/yangrui.0/workplace/ssl/temp/ssl/out/devbox/root.crt -> ../root.crt
$ tree out
out
├── cert.key.pem
├── devbox
│   ├── 20210701-1824
│   │   ├── devbox.bundle.crt
│   │   ├── devbox.crt
│   │   └── devbox.csr.pem
│   ├── devbox.bundle.crt -> ./20210701-1824/devbox.bundle.crt
│   ├── devbox.crt -> ./20210701-1824/devbox.crt # server端证书
│   ├── devbox.key.pem -> ../cert.key.pem # server端key
│   └── root.crt -> ../root.crt
├── index.txt
├── index.txt.attr
├── index.txt.attr.old
├── index.txt.old
├── newcerts
│   └── 1000.pem
├── root.crt     # 根证书
├── root.key.pem
├── serial
└── serial.old

3 directories, 17 files
```

现在通过创建 Golang 的 HTTPS 服务来测试：

```go
package main

import (
  "net/http"
)

func main() {
  http.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
    rw.Write([]byte("hello, world"))
  })
  panicIfErr(http.ListenAndServeTLS(":8888", "out/devbox/devbox.crt", "out/devbox/devbox.key.pem", nil))
}

func panicIfErr(err error) {
  if err != nil {
    panic(err)
  }
}
```

`curl`通过`--cacert`选项选择根证书验证：

```zsh
$ sudo sh -c "echo '127.0.0.1 devbox' >>/etc/hosts"
$ go run main.go &
$ curl https://devbox:8888 --cacert out/root.crt
hello, world%
```

Debian 安装系统根证书：

```zsh
$ sudo apt-get install ca-certificates
$ sudo cp out/root.crt /usr/local/share/ca-certificates/
$ sudo update-ca-certificates
Updating certificates in /etc/ssl/certs...
1 added, 0 removed; done.
Running hooks in /etc/ca-certificates/update.d...
done.
$ curl https://devbox:8888
hello, world%
```

Debian 卸载根证书：

```zsh
$ sudo rm /usr/local/share/ca-certificates/root.crt
$ sudo cp out/root.crt /usr/local/share/ca-certificates/
$ sudo update-ca-certificates --fresh
Clearing symlinks in /etc/ssl/certs...
done.
Updating certificates in /etc/ssl/certs...
137 added, 0 removed; done.
Running hooks in /etc/ca-certificates/update.d...
done.
$ curl https://devbox:8888
curl: (60) SSL certificate problem: unable to get local issuer certificate
More details here: https://curl.haxx.se/docs/sslcerts.html
...
```

## 使用公网的 DNS 与免费 SSL 证书

自签名证书有个比较大的缺点就是，需要将自签名的 CA 证书放到每个需要访问的客户端，比较繁琐；并且修改 Host 也不方便。

因此可以采用公网的 DNS 服务进行域名解析，经过尝试，可以配置将阿里云的域名解析为内网 IP，这样所有的客户端节点只要能连接公网，就可以直接获取内网 IP。

并且也可以申请该域名的证书，部署到本地服务端，这样所有的客户端节点就可以直接通过正规 CA 机构验证服务端的签名了。

## 搭建内网可用的 registry 私有仓库

先在阿里云上配置 DNS 解析，将`devbox.sweetlove.top`解析为 devbox 的 IP。然后申请这个域名的证书，下载到 devbox 的`/certs`目录下。

```zsh
$ ssh root@devbox.sweetlove.top docker run -d \
    --restart=always \
    --name registry \
    -v $HOME/certs:/certs \
    -e REGISTRY_HTTP_TLS_CERTIFICATE=/certs/devbox.sweetlove.top.pem \
    -e REGISTRY_HTTP_TLS_KEY=/certs/devbox.sweetlove.top.key \
    -p 5000:5000 \
    registry
db84d3f45cba
$ docker tag busybox devbox.sweetlove.top:5000/busybox
$ docker push devbox.sweetlove.top:5000/busybox:latest
The push refers to repository [devbox.sweetlove.top:5000/busybox]
5b8c72934dfc: Pushed
latest: digest: sha256:dca71257cd2e72840a21f0323234bb2e33fea6d949fa0f21c5102146f583486b size: 527
$ docker rmi devbox.sweetlove.top:5000/busybox:latest
Untagged: devbox.sweetlove.top:5000/busybox:latest
Untagged: devbox.sweetlove.top:5000/busybox@sha256:dca71257cd2e72840a21f0323234bb2e33fea6d949fa0f21c5102146f583486b
$ docker pull devbox.sweetlove.top:5000/busybox:latest
latest: Pulling from busybox
Digest: sha256:dca71257cd2e72840a21f0323234bb2e33fea6d949fa0f21c5102146f583486b
Status: Downloaded newer image for devbox.sweetlove.top:5000/busybox:latest
devbox.sweetlove.top:5000/busybox:latest
```

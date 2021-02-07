---
title: '优化 Golang 服务镜像'
date: 2020-12-02
categories: [Dev-Ops]
tags: [Docker, Golang]
---

`Dockerfile` like this to make base image:

```dockerfile
FROM alpine:latest
apk add --no-cache libc6-compat
```

Run `docker build -t alpine:lib .` in console.

`Dockerfile` to make final image:

```dockerfile
FROM golang:1.12 AS builder
WORKDIR /tmp
RUN CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -tags netgo -v -o service ./cmd

FROM alpine:lib
WORKDIR /root/
COPY --from=builder /tmp/service .
COPY --from=builder /usr/share/zoneinfo/ /usr/share/zoneinfo/
ENTRYPOINT  ["./service"]
```

通过 Dockerfile 的多阶段构建，在带有完整 Golang 环境的镜像中编译好二进制文件，再拷贝到只带有运行环境的 Alpine 镜像中运行。这样得到的镜像只有二十几 MB，而用 Golang 的默认镜像得有 800 多 MB。

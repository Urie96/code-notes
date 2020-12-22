---
title: '优化 Golang 服务镜像'
date: 2020-12-02
categories: [Dev-Ops]
tags: [Docker, Golang]
---

## Alpine for Running Golang Service

`Dockerfile` like this to make base image:

```dockerfile
FROM alpine:latest AS builder
apk add --no-cache libc6-compat
```

Run `docker build -t alpine:lib .` in console.

`Dockerfile` to make final image:

```dockerfile
FROM alpine
```

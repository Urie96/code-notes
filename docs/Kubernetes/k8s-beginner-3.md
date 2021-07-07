---
title: Kubernetes(三)：Pod
date: 2021-07-01 20:07:03 GMT+0800
categories: [Kubernetes]
tags: [Kubernetes, Linux]
---

::: tip
Pod 是 K8S 的基本单位，它的内部可以有多个容器，容器之间共享 localhost 网络。
:::

<!-- more -->

## 创建简单的服务器

任意的请求都会返回服务端的主机名，在 Pod 中主机名就是 Pod 名字

源码：

```go
package main

import (
  "fmt"
  "net/http"
  "os"
)

func main() {
  http.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
    hostname, err := os.Hostname()
    panicIfErr(err)
    _, err = rw.Write([]byte("hit " + hostname + "\n"))
    panicIfErr(err)
  })
  fmt.Println("starting server...")
  panicIfErr(http.ListenAndServe(":8080", nil))
}

func panicIfErr(err error) {
  if err != nil {
    panic(err)
  }
}
```

Dockerfile：

```dockerfile
FROM alpine:latest
COPY ./hello-server .
CMD ["./hello-server"]
```

推送到私有仓库：

```sh
CGO_ENABLED=0 GOOS=linux GOARCH=amd64 go build -o hello-server # 交叉编译为 Linux 可执行文件
docker build -t devbox.sweetlove.top:5000/hello-server . # 打包为镜像
docker push devbox.sweetlove.top:5000/hello-server:latest
```

## 创建 Pod

宿主机直接使用命令行创建，并尝试访问：

```zsh
$ kubectl run simple-server --image=devbox.sweetlove.top:5000/hello-server # 节点会自动从私有仓库拉取镜像
pod/simple-server created
$ kubectl get po -o wide
NAME            READY   STATUS    RESTARTS   AGE   IP                NODE        NOMINATED NODE   READINESS GATES
simple-server   1/1     Running   0          30s   192.168.166.133   node2.k8s   <none>           <none>
$ ssh root@node1.k8s curl -sS 192.168.166.133:8080 # 集群内任意节点都能访问
hit simple-server
$ ssh root@master.k8s curl -sS 192.168.166.133:8080 # 集群内任意节点都能访问
hit simple-server
$ curl -sS 192.168.166.133:8080 # 宿主机在集群外，不能访问
*   Trying 192.168.166.133...
* TCP_NODELAY set
^C
```

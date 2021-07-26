---
title: Golang基于本地套接字进行通信
date: 2021-07-26 16:29:09 GMT+0800
categories: [Back-End]
tags: [Linux, Golang]
---

::: tip
使用 HTTP 协议是本地进程间通信的一种方式，通过虚拟`lo`网卡模拟真实网卡进行本地数据转发。但网络协议层层包装，封装与解析有性能损耗，并且本地端口也有限。所以本节使用本地 sock 文件  绕过 IP 层协议，直接进行数据转发。
:::

<!-- more -->

## 基于本地套接字的 TCP 通信

Server 代码：

```go
// server.go
package main

import (
  "fmt"
  "net"
  "os"
)

func main() {
  addr := "/tmp/foo.sock"
  os.Remove(addr) // 先删除sock文件，不然二次运行会提示文件已被绑定
  l, _ := net.Listen("unix", addr)
  for {
    c, _ := l.Accept()
    go func() {
      for {
        var req string
        fmt.Fscanln(c, &req)
        fmt.Println(req)
        fmt.Fprintf(c, "resp: %s\n", req)
      }
    }()
  }
}
```

Client 代码：

```go
// client.go
package main

import (
  "io"
  "net"
  "os"
)

func main() {
  addr := "/tmp/foo.sock"
  c, _ := net.Dial("unix", addr)
  defer c.Close()
  go io.Copy(c, os.Stdin)
  io.Copy(os.Stdout, c)
}
```

**测试：**

::: row

```zsh
$ go run server.go

hello

world

hello2
```

```zsh
$ go run client.go
hello # 标准输入
resp: hello
world # 标准输入
resp: world
# 客户端1未断开连接
```

```zsh
$
$
$
$
$ go run client.go # 启动第2个客户端
hello2 # 标准输入
resp: hello2
```

:::

## 基于本地套接字的 HTTP 通信

Server 代码：

```go
// http-server.go
package main

import (
  "fmt"
  "io"
  "net"
  "net/http"
  "os"
)

func main() {
  addr := "/tmp/foo.sock"
  os.Remove(addr) // 先删除sock文件，不然二次运行会提示文件已被绑定
  l, _ := net.Listen("unix", addr)
  http.Serve(l, echoHandler{})
}

type echoHandler struct{}

func (echoHandler) ServeHTTP(rw http.ResponseWriter, r *http.Request) {
  fmt.Println(r.Method, r.URL.Path+"?"+r.URL.Query().Encode(), r.Proto)
  for k, v := range map[string][]string(r.Header) {
    fmt.Print(k + ": ")
    for _, str := range v {
      fmt.Print(str)
    }
    fmt.Println()
  }
  b, _ := io.ReadAll(r.Body)
  fmt.Println()
  fmt.Println(string(b))
  rw.Write([]byte("ok"))
}
```

Client 代码：

```go
// http-client.go
package main

import (
  "context"
  "fmt"
  "io"
  "net"
  "net/http"
  "strings"
)

var addr = "/tmp/foo.sock"

func main() {
  client := &http.Client{
    Transport: &http.Transport{
      DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
        var d net.Dialer
        return d.DialContext(ctx, "unix", addr)
      },
    },
  }
  resp, _ := client.Post("http://123/test?page=1&size=2", "plain", strings.NewReader("hello, world"))
  b, _ := io.ReadAll(resp.Body)
  fmt.Println(string(b))
}
```

**测试：**

::: row

```zsh
$  go run http-server.go

POST /test?page=1&size=2 HTTP/1.1
User-Agent: Go-http-client/1.1
Content-Length: 12
Content-Type: plain
Accept-Encoding: gzip

hello, world
```

```zsh
$
$ go run http-client.go
ok
$
```

:::

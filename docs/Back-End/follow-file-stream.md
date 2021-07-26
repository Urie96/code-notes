---
title: 使用Golang监听文件写入并将新内容追加到Reader流
date: 2021-07-08 10:27:11 GMT+0800
categories: [Back-End]
tags: [Golang, Linux]
---

::: tip
对于写入文件的日志文件，通常希望能够持续地将新增的日志输出到控制台上方便查看，可以通过`tail -f <file>`来实现，如果需要更复杂的功能，则需要自己实现。
:::

<!-- more -->

## 监听文件写入事件

使用开源项目 [fsnotify](https://github.com/fsnotify/fsnotify) 进行监听：

```go
// main.go
package main

import (
  "log"

  "github.com/fsnotify/fsnotify"
)

func main() {
  watcher, err := fsnotify.NewWatcher()
  if err != nil {
    log.Fatal(err)
  }
  defer watcher.Close()

  err = watcher.Add("/tmp/foo")
  if err != nil {
    log.Fatal(err)
  }

  for {
    select {
    case event, ok := <-watcher.Events:
      if !ok {
        return
      }
      log.Println("event:", event)
      if event.Op&fsnotify.Write == fsnotify.Write {
        log.Println("modified file:", event.Name)
      }
    case err, ok := <-watcher.Errors:
      if !ok {
        return
      }
      log.Println("error:", err)
    }
  }
}
```

**测试：**

::: row

```zsh
$
$ go run main.go

2021/07/08 10:39:17 event: "/tmp/foo": WRITE
2021/07/08 10:39:17 modified file: /tmp/foo

2021/07/08 10:42:10 event: "/tmp/foo": CHMOD

2021/07/08 10:46:01 event: "/tmp/foo": REMOVE
```

```zsh
$ touch /tmp/foo

$ echo hello >> /tmp/foo


$ touch /tmp/foo

$ rm /tmp/foo
```

:::

## 打印文件内容

Reader 的函数原型如下：

```go
Read(b []byte) (n int, err error)
```

::: tip
函数实现时，先判断 b 的长度，在长度范围内尽可能将内容填充，并返回实际填充的长度以及错误。
如果暂时没有内容，应该阻塞，直到有内容，而不是返回`n=0`，否则会使调用处大量循环读。
如果永久的没有新内容，则返回`err=io.EOF`，调用处不再调用。
:::

**代码：**

```go
// main.go
package main

import (
  "fmt"
  "log"
  "os"
)

func main() {
  file, _ := os.Open("/tmp/foo")
  buf := make([]byte, 1)
  for {
    n, err := file.Read(buf)
    if err != nil {
      log.Fatal(err)
    }
    fmt.Printf("read: %s\n", string(buf[:n]))
  }
}
```

**测试：**

```zsh
$ echo ab > /tmp/foo
$ go run main.go
read: a
read: b
read:

2021/07/08 10:55:30 EOF
exit status 1
```

## 最终实现文件监听并输出

需要将原有`file`的`Reader()`函数进行封装，不让其返回`io.EOF`传播到真正的调用处，封装的`Reader()`在文件到达末尾后应阻塞，直到写入事件到来，再重新尝试读：

```go
// main.go
package main

import (
  "io"
  "os"

  "github.com/fsnotify/fsnotify"
)

func main() {
  file, _ := FollowFile("/tmp/foo")
  io.Copy(os.Stdout, file)
}

type FollowedFile struct {
  *os.File
  watcher *fsnotify.Watcher
}

func FollowFile(path string) (file *FollowedFile, err error) {
  file = &FollowedFile{}
  if file.File, err = os.Open(path); err != nil {
    return nil, err
  }
  if file.watcher, err = fsnotify.NewWatcher(); err != nil {
    return nil, err
  }
  if err = file.watcher.Add(path); err != nil {
    return nil, err
  }
  return file, nil
}

func (f FollowedFile) Read(b []byte) (int, error) {
  for {
    n, err := f.File.Read(b)
    if err == io.EOF { // 现有文件已经读取完毕
      select {
      case _, ok := <-f.watcher.Events: // 事件到来时唤醒，重新尝试读
        if !ok { // 通道已关闭
          return 0, io.EOF
        }
      case err, ok := <-f.watcher.Errors:
        if !ok { // 通道已关闭
          return 0, io.EOF
        }
        return 0, err
      }
    } else {
      return n, err
    }
  }
}

func (f FollowedFile) Close() error { // 调用Close后，Reader函数永远返回io.EOF
  f.File.Close()
  return f.watcher.Close()
}
```

**测试：**

::: row

```zsh
$
$ go run main.go
hello

world
```

```zsh
$ echo hello > /tmp/foo


$ echo world >> /tmp/foo
```

:::

## 远程 HTTP 监听

先发送 HTTP header，过一秒再发送 body

```go
package main

import (
  "net/http"
  "time"
)

func main() {
  http.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
    rw.WriteHeader(200)
    time.Sleep(time.Second * 3)
    rw.Write([]byte("hello, world\n"))
  })
  http.ListenAndServe(":8080", nil)
}
```

**测试：**

```zsh
$ curl -v localhost:8080
*   Trying ::1...
* TCP_NODELAY set
* Connected to localhost (::1) port 8080 (#0)
> GET / HTTP/1.1
> Host: localhost:8080
> User-Agent: curl/7.64.1
> Accept: */*
> # 阻塞3秒
< HTTP/1.1 200 OK
< Date: Mon, 26 Jul 2021 07:59:42 GMT
< Content-Length: 12
< Content-Type: text/plain; charset=utf-8
<
hello, world
* Connection #0 to host localhost left intact
* Closing connection 0
```

::: tip
过了 3 秒才收到头部，猜测是为了提升性能，默认需要攒够足够的响应数据再发送数据包。
:::

如果在中间插入`Flush()`就可以立即发送数据：

```diff
rw.WriteHeader(200)
+ rw.(http.Flusher).Flush()
time.Sleep(time.Second * 3)
rw.Write([]byte("hello, world\n"))
```

**测试：**

```zsh
$ curl -v localhost:8080
*   Trying ::1...
* TCP_NODELAY set
* Connected to localhost (::1) port 8080 (#0)
> GET / HTTP/1.1
> Host: localhost:8080
> User-Agent: curl/7.64.1
> Accept: */*
>
< HTTP/1.1 200 OK
< Date: Mon, 26 Jul 2021 07:59:42 GMT
< Content-Length: 12
< Content-Type: text/plain; charset=utf-8
< # 阻塞3秒
hello, world
* Connection #0 to host localhost left intact
* Closing connection 0
```

所以可以包装一个`Writer`，使其每次调用`Write()`时都自动调用`Flush()`：

```go
package main

import (
  "io"
  "net/http"
  "os"
  "sync"
  "time"

  "github.com/fsnotify/fsnotify"
)

func main() {
  http.HandleFunc("/", func(rw http.ResponseWriter, r *http.Request) {
    rw.WriteHeader(200)
    rw.(http.Flusher).Flush()
    w := NewWriteFlusher(rw)
    time.Sleep(time.Second * 3)
    file, _ := FollowFile("/tmp/foo")
    io.Copy(w, file)
  })
  http.ListenAndServe(":8080", nil)
}

// WriteFlusher wraps the Write and Flush operation ensuring that every write
// is a flush. In addition, the Close method can be called to intercept
// Read/Write calls if the targets lifecycle has already ended.
type WriteFlusher struct {
  w           io.Writer
  flusher     flusher
  flushed     chan struct{}
  flushedOnce sync.Once
  closed      chan struct{}
  closeLock   sync.Mutex
}

type flusher interface {
  Flush()
}

var errWriteFlusherClosed = io.EOF

func (wf *WriteFlusher) Write(b []byte) (n int, err error) {
  select {
  case <-wf.closed:
    return 0, errWriteFlusherClosed
  default:
  }

  n, err = wf.w.Write(b)
  wf.Flush() // every write is a flush.
  return n, err
}

// Flush the stream immediately.
func (wf *WriteFlusher) Flush() {
  select {
  case <-wf.closed:
    return
  default:
  }

  wf.flushedOnce.Do(func() {
    close(wf.flushed)
  })
  wf.flusher.Flush()
}

// Flushed returns the state of flushed.
// If it's flushed, return true, or else it return false.
func (wf *WriteFlusher) Flushed() bool {
  // BUG(stevvooe): Remove this method. Its use is inherently racy. Seems to
  // be used to detect whether or a response code has been issued or not.
  // Another hook should be used instead.
  var flushed bool
  select {
  case <-wf.flushed:
    flushed = true
  default:
  }
  return flushed
}

// Close closes the write flusher, disallowing any further writes to the
// target. After the flusher is closed, all calls to write or flush will
// result in an error.
func (wf *WriteFlusher) Close() error {
  wf.closeLock.Lock()
  defer wf.closeLock.Unlock()

  select {
  case <-wf.closed:
    return errWriteFlusherClosed
  default:
    close(wf.closed)
  }
  return nil
}

// NewWriteFlusher returns a new WriteFlusher.
func NewWriteFlusher(w io.Writer) *WriteFlusher {
  var fl flusher
  if f, ok := w.(flusher); ok {
    fl = f
  } else {
    fl = &NopFlusher{}
  }
  return &WriteFlusher{w: w, flusher: fl, closed: make(chan struct{}), flushed: make(chan struct{})}
}

type NopFlusher struct{}

// Flush is a nop operation.
func (f *NopFlusher) Flush() {}
```

**测试：**

::: row

```zsh
$ curl localhost:8080

hello

world
```

```zsh
$
$ echo hello >> /tmp/foo
$
$ echo world >> /tmp/foo
$
```

:::

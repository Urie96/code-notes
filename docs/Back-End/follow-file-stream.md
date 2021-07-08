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
  if file.File, err = os.OpenFile(path, os.O_RDONLY, 0777); err != nil {
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

---
title: Golang开启守护进程
date: 2021-07-08 11:18:33 GMT+0800
categories: [Back-End]
tags: [Golang, Linux]
---

::: tip
通常服务启动后就会一直在前台运行，或者使用`nohup <command> &`在后台运行，但还是不太优雅，可以实现像`nginx`一样运行一下就在后台启动了。
:::

<!-- more -->

## C 语言开启守护进程

`fork()`函数完全复制了一份主进程的内存空间（包括程序计数器），成为子进程。当子进程结束时需要由父进程回收资源（即僵尸进程），当父进程先结束时，子进程会成为 1 号进程的子进程。

```c
// main.c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int main() {
    pid_t pid = fork();
    if (pid < 0) {
        perror("fork");
    }
    else if (pid == 0) {
        printf("child pid: %d\n", getpid());
        sleep(3600);
        exit(0);
    }
    printf("father(%d) fork a child(%d)\n", getpid(), pid);
    sleep(3600); // 等待程序退出
}
```

**测试：**

```zsh
$ gcc main.c -o main && ./main
[1] 1411339
father(1411339) fork a child(1411340)
child pid: 1411340
$ pstree -asp 1411340 # 查看子进程的父进程链
systemd,1 nokaslr
  └─sshd,1038 -D
      └─sshd,1406347
          └─sshd,1406368
              └─bash,1406370
                  └─main,1411339
                      └─main,1411340
$ kill -2 1411339 # 关闭父进程
[1]  + 1521798 interrupt  ./main
$ pstree -asp 1411340 # 父进程结束后再查看
systemd,1 nokaslr
  └─main,1411340
```

::: tip
不能在控制台输入<kbd>Ctrl</kbd>+<kbd>C</kbd>发送`SIGINT`信号中断父进程，这样会将信号传递到子进程。
:::

## Golang 开启子进程

Golang 没有`fork()`函数，但可以模拟：

```go
// main.go
package main

import (
  "fmt"
  "os"
  "os/exec"
  "time"
)

func main() {
  if os.Getppid() == 1 { // 守护进程
    fmt.Println("守护进程：", os.Getpid())
    time.Sleep(time.Minute * 5)
  } else { // 主进程
    fmt.Println("父进程：", os.Getpid())
    cmd := exec.Command(os.Args[0], os.Args[1:]...) // 新建子进程，执行同样的代码
    logfile, _ := os.OpenFile("log", os.O_WRONLY|os.O_CREATE|os.O_APPEND, 0777)
    cmd.Stdout = logfile // 不依赖父进程，父进程结束后子进程也能使用文件
    cmd.Stderr = logfile
    cmd.Start()
    fmt.Println("子进程", cmd.Process.Pid)
    // 主进程退出，子进程由1号进程接管
  }
}

```

::: warning
上面的代码中，要求子进程启动后父进程应立即结束，保证子进程运行时已经由 1 号进程接管，否则将无限地创建子进程。
:::

**测试：**

```zsh
$ go run main.go
父进程： 1462007
子进程 1462012
$ cat log
守护进程： 1462012
$ pstree -asp 1462012
systemd,1 nokaslr
  └─main,1462012
      ├─{main},1462013
      ├─{main},1462014
      ├─{main},1462015
      └─{main},1462016
```

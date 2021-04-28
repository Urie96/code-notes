---
title: C语言网络编程（二）：阻塞I/O + 多进程
date: 2021-04-25 10:08:07 GMT+0800
categories: [Network-Program]
tags: [Linux, C]
---

::: tip
主进程负责循环调用`accept()`来处理每个新 TCP 连接，对每个 TCP 连接，fork 一个子进程专门处理字节流。
:::

<!-- more -->

> 注：`lib/common.h`中的函数可以查看[此处](./lib.md)。

## 前置知识

### `fork()`

调用`fork()`之后，进程的所有信息被完整复制了一份给子进程（包括但不限于打开的文件描述符、程序计数器、内存空间）。
所以`fork()`之后的代码会分别被父进程和子进程执行：

```c
// fork1.c
#include <stdio.h>
#include <unistd.h>

int main() {
  printf("Hello. My pid is: %d\n", getpid());
  fork();
  printf("Hi. My pid is: %d\n", getpid());
}
```

运行：

```zsh
$ ./fork1
Hello. My pid is: 83196
Hi. My pid is: 83196
Hi. My pid is: 83197
```

为了让父子进程执行的代码不同，可以根据`fork()`的返回值来判断（子进程返回 0，父进程返回子进程的 pid）：

```c
// fork2.c
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
    exit(0);
  }
  printf("father(%d) fork a child(%d)\n", getpid(), pid);
  sleep(6000000);
}
```

```zsh
$ ./fork2 &
[1] 2704
father(2704) fork a child(2706)
child pid: 2706
$ ps -o pid,ppid,stat,command -p 2704 2706
  PID  PPID STAT COMMAND
 2704 82278 SN   ./fork2 # 父进程，S表示sleep，N表示低优先级（因为是在后台运行）
 2706  2704 ZN   (fork)  # 子进程，Z表示zombie，僵尸进程
$ kill -9 2706           # 尝试杀掉子进程
$ ps -o pid,ppid,stat,command -p 2704 2706
  PID  PPID STAT COMMAND
 2704 82278 SN   ./fork2
 2706  2704 ZN   (fork)  # 子进程还在
$ kill -9 2704           # 尝试杀掉父进程
$ ps -o pid,ppid,stat,command -p 2704 2706
  PID  PPID STAT COMMAND # 父进程和子进程都结束了
```

即使子进程调用了`exit()`，但它仍然存在，成为了僵尸进程，而且僵尸进程只能由父进程来回收。

子进程结束时会向父进程发送`SIGCHLD`信号，父进程注册这个信号的响应处理函数，并在其中回收子进程：

```c{7}
// fork3.c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

void sigchld_handler(int sig) {
  pid_t pid = wait(NULL); // 阻塞，直到有子进程结束，回收子进程资源
  printf("child(%d) over\n", pid);
}

int main() {
  signal(SIGCHLD, sigchld_handler); // 在子进程启动前注册SIGCHLD信号事件
  pid_t pid = fork();
  if (pid < 0) {
    perror("fork");
  }
  else if (pid == 0) {
    printf("child pid: %d\n", getpid());
    exit(0);
  }
  printf("father(%d) fork a child(%d)\n", getpid(), pid);
  sleep(6000000); // 如果触发SIGCHLD信号事件时父进程在sleep中，则会中断sleep并执行事件。
  // 如果主进程不是用sleep阻塞，而是while(1)循环中，事件同样会被触发。
  printf("sleep() was interrupt by signal SIGCHLD\n");
  sleep(6000000);
}
```

::: tip
代码中高亮显示的`wait()`函数，在高并发中不应使用，因为如果有多个子进程同时结束，父进程将同时收到多个`FIGCHLD`信号，但只进行了一次`wait()`调用，导致仍有僵尸进程没有回收。

而应改为：

```c
while (waitpid(-1, 0, WNOHANG) > 0);
```

其中第一个参数 pid 可以指定等待的子进程 pid，`-1`表示任意一个子进程；`WNOHANG`表示不阻塞；返回值表示已回收的子进程 pid，`-1`表示没有子进程结束。
这样便可以在一次事件处理函数中回收所有的僵尸进程。
:::

```zsh
$ ./fork3 &
[1] 6594
father(6594) fork a child(6596)
child pid: 6596
child(6596) over
sleep() was interrupt by signal SIGCHLD
$ ps -o pid,ppid,stat,command -p 6594 6596
  PID  PPID STAT COMMAND
 6594 82278 SN   ./fork3
```

## 阻塞 I/O 的多进程

`lib/common.h`见[依赖函数](./network-program-lib.md).

```C
// tcp-mp.c
#include "lib/common.h"

void sigchld_handler(int sig) {
  pid_t pid = wait(NULL);
  printf("child(%d) over\n", pid);
}

int main(int argc, char **argv) {
  uint16_t port = atoi(argv[1]);
  int sockfd = make_tcp_socket(port);
  signal(SIGCHLD, sigchld_handler); // 注册事件，回收僵尸子进程
  while (1) {
    conn_arg args;
    accept_cli(sockfd, &args);
    if (fork() == 0) {
      close(sockfd); // 子进程复制了sockfd，需要关闭
      printf("accept: client port is %hu\n", args.cli_port);
      echo_tcp(args.connfd, args.cli_port);
      close(args.connfd); // 关闭tcp连接
      exit(0);
    }
    close(args.connfd); // 父进程不再需要connfd
  }
}
```

::: tip
`close()`函数会进行引用计数。
比如 A、B 两个进程在使用一个 fd，此时引用计数为 2。
当 A 进程调用了`close()`，那么引用计数减 1，当 B 进程又调用了`close()`，那么引用计数为 0，内核会进行真正的清理工作。
:::

### 测试

::: row

```zsh
# Terminal1 启动服务端
$ ./tcp-mp 8081
listen port: 8081

accept: client port is 64348

received 14 bytes from port 64348: i am client 1

accept: client port is 64408

received 14 bytes from port 64408: i am client 2
```

```zsh
# Terminal2 启动客户端1
$
$
$ nc localhost 8081

i am client 1

reply: i am client 1
```

```zsh
# Terminal3 启动客户端2
$
$
$
$
$
$
$ nc localhost 8081

i am client 2

reply: i am client 2
```

:::

```zsh
# Terminal4 查看TCP连接
$ lsof -i:8081
COMMAND   PID  USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
tcp-mp  31737 wenr3    3u  IPv4 0x4729e69103fd1fad      0t0  TCP *:sunproxyadmin (LISTEN) # 服务端主进程
nc      31792 wenr3    5u  IPv4 0x4729e690fdbae9ad      0t0  TCP localhost:64348->localhost:sunproxyadmin (ESTABLISHED) # 客户端1
tcp-mp  31793 wenr3    4u  IPv4 0x4729e69121477cad      0t0  TCP localhost:sunproxyadmin->localhost:64348 (ESTABLISHED) # 服务端子进程1
nc      32446 wenr3    5u  IPv4 0x4729e6912146962d      0t0  TCP localhost:64408->localhost:sunproxyadmin (ESTABLISHED) # 客户端1
tcp-mp  32447 wenr3    4u  IPv4 0x4729e6911e65862d      0t0  TCP localhost:sunproxyadmin->localhost:64408 (ESTABLISHED) # 服务端子进程2
$ kill -9 31792 # 关闭客户端1
$ ps -o pid,ppid,stat,command |grep 31737 # 查看服务端进程
31737 24858 S+   ./tcp-mp 8081 # 服务端主进程
32447 31737 S+   ./tcp-mp 8081 # 服务端子进程2
```

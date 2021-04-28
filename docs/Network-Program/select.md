---
title: C语言网络编程（四）：I/O多路复用——`select()`
date: 2021-04-27 15:49:15 GMT+0800
categories: [Network-Program]
tags: [Linux, C]
---

::: tip
之前的内容中，阻塞是为了等待一个 I/O 事件，如果要等待多个事件，则需要使用多进程或者多线程。
`select()`可以阻塞等待许多 I/O 事件，当其中一个或多个 I/O 事件到来时，该函数返回。
接着便轮流查看哪个事件到来了，并作出相应处理。
:::

<!-- more -->

> 注：`lib/common.h`中的函数可以查看[此处](./lib.md)。

## 函数介绍

原型：

```c
#include <unistd.h>

struct timeval {
  __darwin_time_t         tv_sec;         /* seconds */
  __darwin_suseconds_t    tv_usec;        /* and microseconds */
}

int select(int maxfd, fd_set *readset, fd_set *writeset, fd_set *exceptset, const struct timeval *timeout);
```

参数：

- `maxfd`：底层使用了数组，所以要将 fd 的最大值传过去。
- `readset`：需要监听读的 fd 集合，函数返回后会修改该参数，只保留准备好读的 fd。
- `writeset`与`exceptset`：与`readset`类似。
- `timeout`：设置超时，传`NULL`表示用永超时，传零值结构体表示不阻塞直接返回。

返回值：

`0`表示超时，`-1`表示出错。

设置 fd 集合的函数：

```c
void FD_ZERO(fd_set *fdset);　　　　　　// 清空集合
void FD_SET(int fd, fd_set *fdset);　　// 添加fd
void FD_CLR(int fd, fd_set *fdset);　　// 删除fd
int  FD_ISSET(int fd, fd_set *fdset); // 判断fd是否在集合中
```

## 简单使用

`select()`同时监听标准输入和新的 TCP 连接：

```C
// select.c
#include "lib/common.h"

int main(int argc, char **argv) {
  int port = atoi(argv[1]);
  int sockfd = make_tcp_socket(port);

  fd_set fds;
  FD_ZERO(&fds);
  FD_SET(0, &fds); // 添加标准输入流到集合中
  FD_SET(sockfd, &fds);
  while (1) {
    fd_set local_fds = fds; // 使用局部变量，因为select会更改这个
    if (select(sockfd + 1, &local_fds, NULL, NULL, NULL) < 0) {
      perror("select");
    }
    if (FD_ISSET(sockfd, &local_fds)) { // 有TCP连接
      conn_arg arg;
      accept_cli(sockfd, &arg); // 立即返回
      printf("accept: client port is %hu\n", arg.cli_port);
      close(arg.connfd);
    }
    // 没有用else if是因为select的一次返回可能同时有多个事件到来
    if (FD_ISSET(0, &local_fds)) { // 有标准输入流可读
      char buf[50];
      scanf("%s", buf); // 立即返回
      printf("stdin: %s\n", buf);
    }
  }
}
```

::: row

```zsh
$ ./select 8088
listen port: 8088
# 阻塞在此处，等待标准输入“或”TCP连接到来
accept: client port is 56864
# 继续阻塞，等待标准输入“或”TCP连接到来
world # 键盘输入
stdin: world
```

```zsh
$
$
$ nc 127.0.0.1 8088
$
```

:::

## 使用`select()`单线程服务多个客户端

```c
// tcp-select.c
#include "lib/common.h"

#define MAX_CLIENT 1024

int main(int argc, char **argv) {
  int port = atoi(argv[1]);
  int sockfd = make_tcp_socket(port);

  fd_set fds;
  FD_ZERO(&fds);
  FD_SET(sockfd, &fds);

  uint16_t conn_ports[MAX_CLIENT]; // 存储所有connfd的客户端端口
  memset(conn_ports, 0, MAX_CLIENT * sizeof(uint16_t));
  while (1) {
    fd_set local_fds = fds;                                     // 使用局部变量，因为select会更改这个
    if (select(MAX_CLIENT, &local_fds, NULL, NULL, NULL) < 0) { // select()第一个参数超过1024会保错
      perror("select");
    }
    if (FD_ISSET(sockfd, &local_fds)) { // 有TCP连接
      conn_arg arg;
      accept_cli(sockfd, &arg); // 立即返回
      printf("accept: client port is %hu\n", arg.cli_port);
      int connfd = arg.connfd;
      FD_SET(connfd, &fds); // 添加TCP连接，便于select可以监听该连接上的读事件
      conn_ports[connfd] = arg.cli_port;
    }
    for (int i = 0; i < MAX_CLIENT; i++) {                  // 遍历所有TCP连接，找到可读的
      if (conn_ports[i] == 0 || !FD_ISSET(i, &local_fds)) { // 判断该TCP连接是否有数据可读
        continue;
      }
      char buf[1000];

      int n = read(i, buf, sizeof(buf) - 1); // // 立即返回
      if (n < 0) {
        printf("client(port: %hu) closed!\n", conn_ports[i]);
        close(i);
        conn_ports[i] = 0;
        FD_CLR(i, &fds); // select不再监听该TCP
      }
      buf[n] = 0;
      printf("received %d bytes from port %hu: %s\n", n, conn_ports[i], buf);
      write(i, "reply: ", strlen("reply: "));
      write(i, buf, strlen(buf)); // 阻塞直到发送缓冲区足够，因为没有设置select监听该fd的可读事件
    }
  }
}
```

::: tip
经过测试，多个`nc`客户端可以同时访问。

`select()`的缺点是第一个参数不能超过`1024`，而且返回后还需要循环查找可用的 fd。
:::

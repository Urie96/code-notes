---
title: C语言网络编程（五）：I/O多路复用——`poll()`
date: 2021-04-27 17:29:29 GMT+0800
categories: [Network-Program]
tags: [Linux, C]
---

::: tip
`poll()`相比`select()`的改进是，不再有文件描述符个数的限制，不用“备份”监听事件，返回是准备好的 fd 个数，处理完可以立刻返回而不用遍历所有 fd 查看是否准备好。
:::

<!-- more -->

> 注：`lib/common.h`中的函数可以查看[此处](./lib.md)。

## 函数介绍

原型：

```c
#include <poll.h>

struct pollfd {
  int     fd;
  short   events;
  short   revents;
};

int poll(struct pollfd *fds, unsigned int length, int timeout)
```

参数：

- `fds`：`pollfd`数组。
  - `pollfd.events`：需要监听的事件（`POLLIN`、`POLLOUT`、`POLLHUP`等等），可以使用按位或进行组合
  - `pollfd.revents`：`poll()`返回的事件，可以使用按位与进行判断
- `length`：`pollfd`数组长度，不再受限于`1024`。
- `timeout`：设置超时，传`-1`表示永不超时

返回值：

`0`表示超时，`-1`表示出错。

## 搭建简单的 HTTP 服务

```C
// poll.c
#include "lib/common.h"

#define MAX_EVENT 1025

int main(int argc, char **argv) {
  int port = atoi(argv[1]);
  int sockfd = make_tcp_socket(port);

  struct pollfd events[MAX_EVENT];
  events[0].fd = sockfd;
  events[0].events = POLLIN; // 设置监听sockfd的读事件

  for (int i = 1; i < MAX_EVENT; i++) {
    events[i].fd = -1; // -1表示不监听该fd
  }

  uint16_t conn_ports[MAX_EVENT]; // 存储所有connfd的客户端端口
  memset(conn_ports, 0, MAX_EVENT * sizeof(uint16_t));

  while (1) {
    int todo = poll(events, MAX_EVENT, -1); // 阻塞，直到任何事件到来
    if (todo < 0) {
      perror("poll");
    }
    if (events[0].revents & POLLIN) { // 检查sockfd是否有读事件
      conn_arg arg;
      accept_cli(sockfd, &arg); // 立即返回
      printf("accept: client port is %hu\n", arg.cli_port);
      conn_ports[arg.connfd] = arg.cli_port;
      for (int i = 0; i < MAX_EVENT; i++) {
        if (events[i].fd == -1) { // 在数组中找到可用的event
          events[i].fd = arg.connfd;
          events[i].events = POLLIN | POLLHUP; // 监听TCP连接的读事件和中断事件
          break;
        }
      };
      if (--todo <= 0)
        continue; // 处理完了，说明后面没有准备好的数据了，直接返回
    }
    for (int i = 1; i < MAX_EVENT; i++) {
      if (events[i].fd < 0)
        continue;
      int fd = events[i].fd;
      if (events[i].revents & (POLLIN | POLLHUP | POLL_ERR)) { // 判断该fd是否有读事件、中断事件或者错误事件
        char buf[1000];
        int n = read(fd, buf, sizeof(buf) - 1); // 立即返回
        if (n < 0) {
          printf("client(port: %hu) closed!\n", conn_ports[fd]);
          conn_ports[fd] = 0;
          events[i].fd = -1; // poll 不再监听该TCP
          close(fd);
        } else {
          buf[n] = 0;
          printf("received %d bytes from port %hu: %s\n", n, conn_ports[fd], buf);
          write(fd, "reply: ", strlen("reply: "));
          write(fd, buf, strlen(buf)); // 阻塞直到发送缓冲区足够，因为没有设置select监听该fd的可读事件
        }
        if (--todo <= 0)
          break;
      }
    }
  }
}
```

::: tip
经过测试，能同时为多个`nc`连接提供服务。

`poll()`的缺点是需要轮询 fd 数组查找有事件的 fd。
:::

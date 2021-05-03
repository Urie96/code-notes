---
title: C语言网络编程（六）：I/O多路复用——epoll
date: 2021-04-30 11:32:35 GMT+0800
categories: [Network-Program]
tags: [Linux, C]
---

::: tip
`select()`与`poll()`都有两个共同的缺点，就是阻塞返回后，需要遍历所有 fd，从中查找哪些 fd 有新事件；并且如果事件未被彻底处理，那么继续调用多路复用函数将会直接返回。
epoll 解决了这两个问题，可以将具有新事件的 fd 放在单独的数组里，无需遍历“无用”事件；还可以设置 ET 模式，不会重复提醒旧的未处理事件。
:::

<!-- more -->

## 通过 Docker 使用 epoll

由于 epoll 出来的比较晚（2002 年），MacOS 采用的是 kqueue，内核并没有实现 epoll。
只有借助 Docker Daemon 的内核，在 gcc 容器中执行代码。命令如下：

```zsh
$ docker run --rm -it -v "$PWD:/home" -p 8088:8088 gcc:10.3.0 bash # ads
root@7b30039f4824:/$ cd /home
root@7b30039f4824:/$
```

## epoll 基本用法

原型：

```c
typedef union epoll_data {
  void *ptr;
  int fd;
  uint32_t u32;
  uint64_t u64;
} epoll_data_t;

struct epoll_event {
  uint32_t events;   // 感兴趣的事件，使用位运算控制
  epoll_data_t data; // fd
};

int epoll_create(int size);
int epoll_ctl(int epfd, int op, int fd, struct epoll_event *event);
int epoll_wait(int epfd, struct epoll_event *events, int maxevents, int timeout);
```

- `epoll_create()`：创建 epoll 句柄，`size`大于 0 即可；
- `epoll_ctl()`：管理 epoll 句柄中感兴趣的 fd 及其事件
  - `op`：`EPOLL_CTL_ADD`、`EPOLL_CTL_DEL`、`EPOLL_CTL_MOD`
  - `event`：需要更新的 fd 及其事件
- `epoll_wait()`：阻塞等待新事件，返回值为新事件数量
  - `events`：新事件数组
  - `maxevents`：传入的数组长度

## ET 触发与 LT 触发

LT 模式表示多路复用函数会被旧的未处理事件触发，ET 模式则不会。

`select()`与`poll()`只能使用 LT 模式，epoll 默认使用 LT，但可以设置为 ET

### 默认的 LT 模式

```c{8}
// epoll-lt.c
#include "lib/common.h"
#include <sys/epoll.h>

int epoll_ctl_add(int ep_fd, int listen_fd) { // 添加感兴趣的fd
  struct epoll_event event;
  event.data.fd = listen_fd;
  event.events = EPOLLIN;
  int res = epoll_ctl(ep_fd, EPOLL_CTL_ADD, listen_fd, &event);
  if (res < 0)
    perror("epoll_ctl");
  return res;
}

int main(int argc, char **argv) {
  u_int16_t port = atoi(argv[1]);
  int sockfd = make_tcp_socket(port);
  int ep_fd = epoll_create(1); // 创建epoll套接字句柄
  if (ep_fd < 0) {
    perror("epoll");
    exit(EXIT_FAILURE);
  }
  epoll_ctl_add(ep_fd, sockfd);   // 让epoll监听socket
  struct epoll_event events[100]; // epoll_wait将新事件放在这个数组
  while (1) {
    int n = epoll_wait(ep_fd, events, 100, -1); // 阻塞，等待任何fd有新事件
    printf("epoll_wait return\n");
    // 没处理新事件
  }
}
```

测试：

::: row

```zsh
$ ./epoll-et 8088
listen port: 8088

epoll_wait return
epoll_wait return
epoll_wait return
... # 一直持续
```

```zsh
$
$
$ nc localhost 8088
```

:::

### 添加`EPOLLET`的 ET 模式

```diff
# epoll-et.c
int epoll_ctl_add(int ep_fd, int listen_fd) {
  struct epoll_event event;
  event.data.fd = listen_fd;
- event.events = EPOLLIN;
+ event.events = EPOLLIN | EPOLLET;
  int res = epoll_ctl(ep_fd, EPOLL_CTL_ADD, listen_fd, &event);
  if (res < 0)
    perror("epoll_ctl");
  return res;
}
```

测试：

::: row

```zsh
$ ./epoll-et 8088
listen port: 8088

epoll_wait return


epoll_wait return
```

```zsh
$
$
$ nc localhost 8088

^C
$ nc localhost 8088
```

:::

## 非阻塞 I/O

前面写的`accept()`、`read()`、`write()`都是阻塞 I/O，虽然可以通过 I/O 多路复用来保证不错过任何事件，但也有例外：

比如如果有新的 TCP 连接到来，多路复用从阻塞中返回，但是程序没有及时调用`accept()`，客户端关闭了连接，程序再调用`accept()`就会阻塞，直到有新的 TCP 连接到来。
如果是单线程处理网络请求，那么其它 TCP 连接也会因为程序的阻塞而得不到及时响应。

```c
// nonclock.c
#include "lib/common.h"
#include <fcntl.h>

int main(int argc, char **argv) {
  u_int16_t port = atoi(argv[1]);
  int sockfd = make_tcp_socket(port);
  fcntl(sockfd, F_SETFL, O_NONBLOCK);
  accept_cli(sockfd, NULL);
  printf("here\n");
}
```

```zsh
$ ./nonlock 8084
listen port: 8084
accept: Resource temporarily unavailable # accept()只报错不阻塞
here
```

## epoll + 非阻塞 I/O

```c
// epoll.c
#include "lib/common.h"
#include <sys/epoll.h>

#define MAXEVENTS 128

int main(int argc, char **argv) {
  u_int16_t port = atoi(argv[1]);
  int sockfd = make_tcp_socket(port);
  fcntl(sockfd, F_SETFL, O_NONBLOCK); // 将socket套接字设为非阻塞

  int ep_fd = epoll_create(1); // 创建epoll套接字句柄
  if (ep_fd < 0) {
    perror("epoll");
    exit(EXIT_FAILURE);
  }
  epoll_ctl_add(ep_fd, sockfd); // 让epoll监听socket
  struct epoll_event events[MAXEVENTS];
  while (1) {
    int n = epoll_wait(ep_fd, events, MAXEVENTS, -1); // 阻塞，等待任何fd有新事件
    printf("epoll_wait return\n");
    for (int i = 0; i < n; i++) {
      if (sockfd == events[i].data.fd) { // 所有新事件被放在单独的数组里，不需要遍历无用的事件
        conn_arg conn;
        accept_cli(sockfd, &conn);
        printf("accept: client port is %hu, fd is %d\n", conn.cli_port, conn.connfd);
        fcntl(conn.connfd, F_SETFL, O_NONBLOCK); // 将TCP连接的套接字设为非阻塞
        epoll_ctl_add(ep_fd, conn.connfd);       // 让epoll监听该TCP套接字
      } else {
        int fd = events[i].data.fd;
        char buf[1000];
        int n;
        do {
          n = read(fd, buf, sizeof(buf)); // 非阻塞
        } while (errno == EAGAIN);        // 如果资源暂时不可读，就重新读，因为这是边缘触发，放过了的话epoll也不会再让读
        if (n <= 0) {
          if (n < 0)
            perror("read");
          printf("client(fd: %d) closed!\n", fd);
          close(fd);
        } else {
          buf[n] = 0;
          printf("received %d bytes from fd %d: %s\n", n, fd, buf);
          write(fd, "reply:", strlen("reply:")); // 为了保持简单，write暂时没考虑是否可发送
          write(fd, buf, strlen(buf));           // 非阻塞
        }
      }
    }
  }
}
```

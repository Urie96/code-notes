---
title: C语言网络编程（三）：阻塞I/O + 多线程 + HTTP服务端
date: 2021-04-25 15:45:28 GMT+0800
categories: [Network-Program]
tags: [Linux, C]
---

::: tip
从多线程 TCP 服务端，到简易的多线程 HTTP 服务端，再到线程池的 HTTP 服务端。
:::

<!-- more -->

> 注：`lib/common.h`中的函数可以查看[此处](./lib.md)。

## 前置知识

### 多线程、互斥锁、条件变量、线程池

点击[此处](../Basics/c-thread.md)跳转。

## 阻塞 I/O + 多线程

主线程只负责管理 TCP 连接，读写交给子线程完成：

```C
// tcp-mt.c
#include "lib/common.h"

void *thread(void *data) {
  pthread_detach(pthread_self()); // 分离线程，线程结束后自动回收
  conn_arg *args = (conn_arg *)data;
  int connfd = args->connfd;
  uint16_t cli_port = args->cli_port;
  free(args); // 回收堆内存，避免内存泄漏
  printf("accept: client port is %hu\n", cli_port);
  echo_tcp(connfd, cli_port);
  close(connfd);
  return NULL;
}

int main(int argc, char **argv) {
  uint16_t port = atoi(argv[1]);
  int sockfd = make_tcp_socket(port);
  while (1) { // 主线程只负责管理TCP连接，读写交给子线程完成
    conn_arg *args = accept_cli(sockfd, NULL);
    pthread_t tid;
    pthread_create(&tid, NULL, thread, args); // 通过args向线程传递参数
  }
}
```

测试：

::: row

```zsh
# Terminal1 启动服务端
$ ./tcp-mt 8082
listen port: 8082

accept: client port is 51500

received 6 bytes from port 51500: hello

accept: client port is 51543

received 6 bytes from port 51543: world
```

```zsh
# Terminal2 启动客户端1
$
$
$ nc localhost 8082

hello # 标准输入

reply: hello
```

```zsh
# Terminal3 启动客户端2
$
$
$
$
$
$
$ nc localhost 8082

world # 标准输入

reply: world
```

:::

```zsh
# Terminal4 查看网络连接
$ lsof -i:8082
COMMAND   PID  USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
tcp-mt  38150 wenr3    3u  IPv4 0x4729e6911e7849ad      0t0  TCP *:us-cli (LISTEN)
tcp-mt  38150 wenr3    4u  IPv4 0x4729e6911e78662d      0t0  TCP localhost:us-cli->localhost:51500 (ESTABLISHED)
tcp-mt  38150 wenr3    5u  IPv4 0x4729e690ffa359ad      0t0  TCP localhost:us-cli->localhost:51543 (ESTABLISHED)
nc      38490 wenr3    5u  IPv4 0x4729e69119bd162d      0t0  TCP localhost:51500->localhost:us-cli (ESTABLISHED)
nc      38984 wenr3    5u  IPv4 0x4729e691014a1cad      0t0  TCP localhost:51543->localhost:us-cli (ESTABLISHED)
$ kill -9 38490
$ lsof -i:8082
COMMAND   PID  USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
tcp-mt  38150 wenr3    3u  IPv4 0x4729e6911e7849ad      0t0  TCP *:us-cli (LISTEN)
tcp-mt  38150 wenr3    5u  IPv4 0x4729e690ffa359ad      0t0  TCP localhost:us-cli->localhost:51543 (ESTABLISHED)
nc      38984 wenr3    5u  IPv4 0x4729e691014a1cad      0t0  TCP localhost:51543->localhost:us-cli (ESTABLISHED)
```

## 升级为 HTTP 服务端

HTTP 协议需要在应用层读取 TCP 字节流并进行切割（HTTP 请求可以根据`\r\n\r\n`字符串进行切割，响应可以根据 HTTP 头部的`Content-Length`或者`Transfer-Encoding: chunked`进行切割）。
这里只实现了对 HTTP 请求的简易切割，并没有解析 HTTP 信息，目的仅仅是为了方便使用浏览器或者`curl`命令。

```c
// http-mt.c
#include "lib/common.h"

#define PORT 8083
#define BUF_SIZE 100
#define MAX_CONN_SIZE 1000

int read_http(int fd, char *req) { // 仅仅考虑了GET或者DELETE等无body的请求
  // 所有连接的读缓冲区，调用read()后可能不止一个HTTP请求的内容，所以需要将第一个HTTP请求后面的内容缓存，供下次读取
  static char *remain_buf[MAX_CONN_SIZE];
  if (remain_buf[fd] == NULL)
    remain_buf[fd] = calloc(BUF_SIZE, sizeof(char));
  else
    strcpy(req, remain_buf[fd]);
  char read_buf[BUF_SIZE];
  while (1) {
    char *p = strstr(req, "\r\n\r\n"); // 待优化：不用从头搜索
    if (p != NULL) {
      p += 4;
      strcpy(remain_buf[fd], p);
      *p = 0;
      return strlen(req);
    }
    int n = read(fd, read_buf, sizeof(read_buf));
    if (n <= 0) {
      if (n < 0) {
        perror("read");
      }
      free(remain_buf[fd]); // TCP连接断开，清除该连接的缓存
      remain_buf[fd] = NULL;
      return -1;
    }
    read_buf[n] = 0;
    strcat(req, read_buf);
  }
}

int write_http(int fd, char *res) {
  char write_buf[200];
  sprintf(write_buf,
          "HTTP/1.1 200 OK\r\nContent-Length: %lu\r\nConnection: "
          "keep-alive\r\n\r\n%s",
          strlen(res), res);
  if (write(fd, write_buf, strlen(write_buf)) <= 0) {
    perror("write");
    return -1;
  }
  return 0;
}

void handle_http(int connfd, u_int16_t cli_port) {
  while (1) {
    char req[BUF_SIZE];
    if (read_http(connfd, req) < 0) {
      printf("client(port: %d) closed!\n", cli_port);
      break;
    }
    printf("received from port %d:\n%s\n", cli_port, req);
    if (write_http(connfd, "hello,world") < 0) {
      break;
    }
  }
  close(connfd);
}

void *thread(void *data) {
  pthread_detach(pthread_self()); // 分离线程，线程结束后自动回收
  conn_arg *args = (conn_arg *)data;
  int connfd = args->connfd;
  uint16_t cli_port = args->cli_port;
  free(args); // 回收堆内存，避免内存泄漏
  printf("accept: client port is %hu\n", cli_port);
  handle_http(connfd, cli_port);
  close(connfd);
  return NULL;
}

int main() {
  int sockfd = make_tcp_socket(PORT);
  while (1) { // 主线程只负责管理TCP连接，读写交给子线程完成
    conn_arg *args = accept_cli(sockfd, NULL);
    pthread_t tid;
    pthread_create(&tid, NULL, thread, args);
  }
}
```

::: row

```zsh
$ ./http-mt 8081
listen port: 8081

accept: client port is 52122
received from port 52122:
GET / HTTP/1.1
Host: localhost:8081
User-Agent: curl/7.54.0
Accept: */*


client(port: 52122) closed!
```

```zsh
$
$
$ curl localhost:8081







hello,world
$ # 继续用浏览器访问，测试正常，长连接正常
```

:::

## 使用线程池

```c
#include "lib/common.h"

#define PORT 8083
#define THREAD_NUMBER 1000

void *execute(void *data) {
  block_queue *blockQueue = (block_queue *)data;
  while (1) {
    conn_arg *arg = (conn_arg *)block_queue_pop(blockQueue);
    printf("accept: client port is %hu\n", arg->cli_port);
    handle_http(arg->connfd, arg->cli_port);
    close(arg->connfd);
    free(arg);
  }
  return NULL;
}

int main() {
  int sockfd = make_tcp_socket(PORT);
  block_queue *queue = make_block_queue();
  for (int i = 0; i < THREAD_NUMBER; i++) {
    pthread_t tid;
    pthread_create(&tid, NULL, execute, queue);
  }
  while (1) {
    conn_arg *args = accept_cli(sockfd, NULL);
    block_queue_push(queue, args);
  }
```

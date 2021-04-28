---
title: C语言网络编程（一）：TCP与UDP
date: 2021-04-22 14:51:24 GMT+0800
categories: [Network-Program]
tags: [Linux, C]
---

::: tip
使用 C 语言完成最朴素的 TCP 与 UDP 服务端。
:::

<!-- more -->

## 网络字节排序

不同的操作系统对于数字有不同的字节序，大端字节序将高字节排在前面，小端字节序则相反。
为了在不同系统间能够统一，需要进行额外的处理。

C 语言提供了 4 种函数提供转换：

```c
uint16_t htons (uint16_t hostshort)
uint16_t ntohs (uint16_t netshort)
uint32_t htonl (uint32_t hostlong)
uint32_t ntohl (uint32_t netlong)
```

其中 h 表示 host，n 表示 network，s 表示 short，l 表示 long。
不同的操作系统对于这些函数有不同的实现，如果系统使用的字节序与网络字节序相同，则直接返回原参数，否则就返回反转后的字节序。

通信中发送数字时需要调用`htons()`或者`htonl()`将数字统一为网络字节序，接收时调用`ntohs()`或者`ntohl()`将网络字节序转换为本系统使用的字节序。

## TCP 服务端

::: tip
由于 socket 的创建时间很早，那时候甚至没有“void\*”，所以有些函数会有很奇怪的参数。
:::

TCP 面向有连接，需要先建立连接，连接是一个**双向字节流**（请求是连续的，没有一次请求的概念，只能在应用层进行切割，响应也一样），可以任意地收发，直到连接关闭。

代码如下。监听本地 8080 TCP 端口，只接收第一个客户端的连接请求，并将数据流的数据的前面加上“reply:”回复给客户端，当客户端关闭时，服务端也关闭。

```c
// tcp.c
#include <stdio.h>
#include <string.h>
#include <sys/socket.h>
#include <netinet/in.h>
#include <unistd.h>

#define BUF_SIZE 100

int make_tcp_socket(uint16_t port) {
  int sockfd = socket(PF_INET, SOCK_STREAM, 0); // PF_INET表示ipv4，SOCK_STREAM表示TCP
  if (sockfd < 0) {
    perror("socket");
    exit(EXIT_FAILURE);
  }
  struct sockaddr_in server_addr;
  memset(&server_addr, 0, sizeof(server_addr));
  server_addr.sin_family = AF_INET;
  server_addr.sin_port = htons(port);
  server_addr.sin_addr.s_addr = htonl(INADDR_ANY);                              // 监听所有地址
  if (bind(sockfd, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) { // 绑定到本地的某个端口
    perror("bind");
    exit(EXIT_FAILURE);
  }
  listen(sockfd, 1024);
  printf("listen port: %d\n", port);
  return sockfd;
}

void echo_tcp(int connfd, uint16_t cli_port) {
  char read_buf[BUF_SIZE];
  char write_buf[BUF_SIZE];
  while (1) {
    int n = read(connfd, read_buf, sizeof(read_buf)); // 阻塞，直到内核的接收缓冲区有数据并拷贝到&read_buf
    if (n == 0) {                                     // 收到TCP的FIN包，即客户端不再发送数据
      printf("client(port: %hu) closed!\n", cli_port);
      break;
    } else if (n < 0) {
      printf("read error\n");
      break;
    }
    read_buf[n] = 0;
    printf("received %d bytes from port %hu: %s\n", n, cli_port, read_buf);
    sprintf(write_buf, "reply: %s", read_buf);
    write(connfd, write_buf, strlen(write_buf)); // 阻塞，直到&write_buf的数据拷贝到内核的发送缓冲区
  }
}

int main(int argc, char **argv) {
  uint16_t port = atoi(argv[1]);
  int sockfd = make_tcp_socket(port);
  conn_arg *args = accept_cli(sockfd, NULL);
  struct sockaddr_in cliaddr;
  memset(&cliaddr, 0, sizeof(cliaddr));
  socklen_t clilen = sizeof(cliaddr);
  int connfd = accept(sockfd, (struct sockaddr *)&cliaddr, &clilen);
  u_int16_t cli_port = ntohs(cliaddr.sin_port);
  printf("accept: client port is %hu\n", cli_port);
  echo_tcp(connfd, cli_port);
  close(sockfd);
  close(connfd);
  return 0;
}
```

测试：

::: row

```zsh
$ ./tcp 8081
listen port: 8081
# 等待客户端连接
accept: client port is 61275
# 等待客户端发送字节流
received 6 bytes from port 61275: hello

```

```zsh
$
$
$ nc localhost 8081 # 客户端连接

hello # 标准输入

reply: hello
```

:::

::: tip 四次挥手
TCP 四次挥手时，假设称主动挥手的一方为主动方，另一方为被动方。
主动方首先发送 FIN 包，被动方接收到后进入 CLOSE_WAIT 状态，并回复 ACK 包（前两次挥手）。
被动方发送完数据后，向主动方发送 FIN 包，主动方进入 TIME_WAIT 状态，并回复 ACK 包（后两次挥手）。
主动方需在 TIME_WAIT 状态的停留时间为 2MSL，然后进入 CLOSED，而被动方在接收到最后一次挥手后立即进入 CLOSED。
主动方之所以需要在 TIME_WAIT 停留，是因为如果最后一次挥手未达时，被动方会重发 FIN 包（第三次挥手），是为了应对这种情况。

所以，当上述的 TCP 服务端与客户端建立连接后，如果主动关闭服务端，则内核会继续占用该端口 60s。

```zsh
$ ./tcp & # 启动服务端
[1] 95767
listen port: 8080
$ netstat -tunlp tcp | grep 8080
# 没有输出，所以现在8080没有TCP连接
$ nc localhost & # 启动客户端
[2] 95803
accept: client port is 53365
[2]  + 95803 suspended (tty input)  nc localhost 8080
$ netstat -tunlp tcp | grep 8080
tcp4       0      0  127.0.0.1.8080         127.0.0.1.53365        ESTABLISHED # 服务端
tcp4       0      0  127.0.0.1.53365        127.0.0.1.8080         ESTABLISHED # 客户端
$ lsof -i :8080
COMMAND   PID  USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
tcp     95767 wenr3    3u  IPv4 0xa5f2bf51f8d504dd      0t0  TCP *:http-alt (LISTEN)
tcp     95767 wenr3    4u  IPv4 0xa5f2bf51d12954dd      0t0  TCP localhost:http-alt->localhost:53365 (ESTABLISHED)
nc      95803 wenr3    5u  IPv4 0xa5f2bf51d12941dd      0t0  TCP localhost:53365->localhost:http-alt (ESTABLISHED)
$ kill -9 95767 # 先关闭服务端
$ lsof -i :8080
COMMAND   PID  USER   FD   TYPE             DEVICE SIZE/OFF NODE NAME
nc      99341 wenr3    5u  IPv4 0xa5f2bf51d12941dd      0t0  TCP localhost:53365->localhost:http-alt (CLOSE_WAIT)
$ netstat -tunlp tcp | grep 8080
tcp4       0      0  127.0.0.1.8080         127.0.0.1.53365        FIN_WAIT_2 # 服务端
tcp4       0      0  127.0.0.1.53365        127.0.0.1.8080         CLOSE_WAIT # 客户端
$ kill -9 95803 # 再关闭客户端
$ lsof -i :8080
# 没有输出，但端口仍然不可用，因为->
$ netstat -tunlp tcp | grep 8080
tcp4       0      0  127.0.0.1.8080         127.0.0.1.53365        TIME_WAIT # 服务端
$ sleep 60000;netstat -tunlp tcp | grep 8080
# 没有输出，连接彻底关闭
```

看来`lsof`关注进程的网络，`netstat`关注网络？
:::

## UDP 服务端

UDP 面向无连接，传输的是**数据报**（与 TCP 双向字节流不同的是 UDP 的不同请求之间有“边界”），每次发送时都需要指定目标的 IP 与端口。

由于 UDP 无连接，不认客户端，只认数据包，所以最朴素的 UDP 服务也能支持任意多的客户端。

代码如下。监听本地 8080 UDP 端口，对于每个收到的数据包，在前面加上“reply:”后发送到客户端。

```C
// udp.c
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <unistd.h>

#define BUF_SIZE 100

int main(int argc, char **argv) {
  uint16_t port = atoi(argv[1]);
  int sockfd = socket(PF_INET, SOCK_DGRAM, 0); // SOCK_DGRAM表示UDP
  struct sockaddr_in server_addr;
  memset(&server_addr, 0, sizeof(server_addr));
  server_addr.sin_family = AF_INET;
  server_addr.sin_addr.s_addr = htonl(INADDR_ANY);
  server_addr.sin_port = htons(port);
  if (bind(sockfd, (struct sockaddr *)&server_addr, sizeof(server_addr)) < 0) { // 监听UDP端口
    perror("bind");
    return -1;
  }
  printf("bind port: %d\n", port);
  socklen_t client_len;
  char read_buf[BUF_SIZE];
  char write_buf[BUF_SIZE];
  struct sockaddr_in client_addr;
  client_len = sizeof(client_addr);
  while (1) {
    int n = recvfrom(sockfd, read_buf, BUF_SIZE, 0, (struct sockaddr *)&client_addr, &client_len); // 阻塞。&client_addr可以为NULL，但是NULL就不能响应，因为不知道客户端
    read_buf[n] = 0;
    printf("received %d bytes from port %hu: %s\n", n, ntohs(client_addr.sin_port), read_buf);
    fflush(stdout);
    sprintf(write_buf, "reply: %s", read_buf);
    sendto(sockfd, write_buf, strlen(write_buf), 0, (struct sockaddr *)&client_addr, client_len); // 阻塞。一定要有客户端IP与端口
  }
}
```

测试：

::: row

```zsh
$ ./udp 8080
bind port: 8080
# 阻塞，等待UDP数据报

received 4 bytes from port 53462: asd
```

```zsh
$
$
$ nc -u 127.0.0.1 8080
asd # 标准输入，发送数据报

reply: asd
```

:::

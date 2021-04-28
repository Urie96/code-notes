---
title: C语言网络编程（附录）：原文中依赖的函数
date: 2021-04-26 12:32:44 GMT+0800
categories: [Network-Program]
tags: [Linux, C]
---

## `make_tcp_socket()`

```c
int make_tcp_socket(int port) {
  int sockfd = socket(PF_INET, SOCK_STREAM, 0); // PF_INET表示ipv4，SOCK_STREAM表示TCP
  if (sockfd < 0) {
    perror("socket");
    exit(EXIT_FAILURE);
  }
  struct sockaddr_in server_addr;
  memset(&server_addr, 0, sizeof(server_addr));
  server_addr.sin_family = AF_INET;
  server_addr.sin_port = htons(port);
  server_addr.sin_addr.s_addr = htonl(INADDR_ANY); // 监听所有地址
  if (bind(sockfd, (struct sockaddr*)&server_addr, sizeof(server_addr)) < 0) { // 绑定到本地的某个端口
    perror("bind");
    exit(EXIT_FAILURE);
  }
  listen(sockfd, 8);
  printf("listen port: %d\n", port);
  return sockfd;
}
```

## `echo_tcp()`

```c
#define BUF_SIZE 1000

void echo_tcp(int connfd, uint16_t cli_port) {
  char read_buf[BUF_SIZE];
  char write_buf[BUF_SIZE];
  while (1) {
    int n = read(connfd, read_buf, sizeof(read_buf)); // 阻塞，直到内核的接收缓冲区有数据并拷贝到&read_buf
    if (n == 0) { // 收到TCP的FIN包，即客户端不再发送数据
      printf("client closed!\n");
      break;
    }
    else if (n < 0) {
      printf("read error\n");
      break;
    }
    read_buf[n] = 0;
    printf("received %d bytes from port %hu: %s\n", n, cli_port, read_buf);
    sprintf(write_buf, "reply: %s", read_buf);
    write(connfd, write_buf, strlen(write_buf)); // 阻塞，直到&write_buf的数据拷贝到内核的发送缓冲区
  }
}
```

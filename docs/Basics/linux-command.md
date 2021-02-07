---
title: Linux常用命令
date: 2021-01-06 12:53:14 GMT+0800
categories: [Basics]
tags: [Linux]
---

## 查看文件

### cat

`cat`可以查看小文件，如果是大文件会全部加载到内存，建议使用其它命令

### less

`less`和`more`类似，只会读取文件的一部分，可以用空格或者鼠标滚轮来前进，但`less`还可以往回翻阅

### tail/head

`tail -n 200 [file]`查看文件末尾 200 行；
`head -n 200 [file]`查看文件开头 200 行；

### grep

### find

## 管道

### 输入输出流

`0`表示标准输入流，`1`表示标准输出流，`2`表示标准错误流

### 重定向

- 输出覆盖重定向

```sh
$ echo hello > out
$ cat out
hello
```

- 输出追加重定向

```sh
$ echo world >> out
$ cat out
hello
world
```

- 输入重定向

```sh
$ cat <out
hello
world
```

::: tip
当`cat`不带参数时会将标准输入流转到标准输出流
:::

- 错误流重定向

```sh
$ abc 2>out
$ cat out
zsh: command not found: abc
```

- 标准输入与标准错误重定向

```sh
$ (echo 111 && abc) >out
zsh: command not found: abc
$ cat out
111
$ (echo 111 && abc) 2>out
111
$ cat out
zsh: command not found: abc
$ (echo 111 && abc) >out 2>&1
$ cat out
111
zsh: command not found: abc
$ (echo 111 && abc) &>out # 与上面的写法等价
$ cat out
111
zsh: command not found: abc
```

- `tee`可以将标准输入流分流到标准输出流以及文件

```sh
$ echo hello | tee out
hello
$ cat out
hello
```

- `xargs`可以将标准输入流根据换行符切分为多个命令参数，并依次执行命令

```sh
$ echo "a\nb\nc" | xargs -t -I {} echo "{}.gz"
echo a.gz
a.gz
echo b.gz
b.gz
echo c.gz
c.gz
```

::: tip

- `-I {}`表示将后面命令中的`{}`全部替换为参数
- `-t`表示执行命令前打印命令语句
- 没有`-I {}`时，xargs 会将所有的输入改为一行并用空格分割，作为后面的命令行参数<Badge text="2021.02.07+" />

:::

- `mkfifo`命令管道

```sh
$ mkfifo pipe
$ cat pipe &
$ echo hello >pipe
hello
```

- `tr`替换字符 <Badge text="2021.02.07+" />

```sh
$ echo `a b`| tr " " "\n"
a
b
```

## 权限

- 创建文件时，文件具有属性拥有者、所属组，默认情况下用户会有一个同名用户组
- `id`可以查看用户名和组名

```sh
$ id
uid=501(wenr3) gid=20(staff) groups=20(staff),12(everyone),61(localaccounts)···
```

## 网络

- `telnet`可以作为客户端，与服务端建立 TCP 连接

```sh
$ telnet sweetlove.top 80
Trying 59.110.71.167...
Connected to sweetlove.top.
Escape character is '^]'.
GET / HTTP/1.1 # 自己输入
Host: sweetlove.top # 自己输入

HTTP/1.1 301 Moved Permanently
Server: nginx/1.19.5
Date: Wed, 06 Jan 2021 08:26:35 GMT
Content-Type: text/html
Content-Length: 169
Connection: keep-alive
Location: https://sweetlove.top/

<html>
<head><title>301 Moved Permanently</title></head>
<body>
<center><h1>301 Moved Permanently</h1></center>
<hr><center>nginx/1.19.5</center>
</body>
</html>
```

- `host`

```sh
$ host www.baidu.com
www.baidu.com is an alias for www.a.shifen.com.
www.a.shifen.com has address 39.156.66.14
www.a.shifen.com has address 39.156.66.18
```

- `nc` <Badge text="2021.02.07+" />

nc 可以作为 TCP 或者 UDP 的客户端或者服务端，非常方便，尤其是查看连接是否互通以及学习新网络协议时。

- 监听 TCP：

```sh
$ nc -l 8080 > /tmp/out &
[1] 43450
$ echo 'hello' | nc localhost 8080
[1]  + 43450 done       nc -l 8080 > /tmp/out
$ cat /tmp/out
hello
```

- 监听 UDP：

```sh
$ nc -lu 8080 > /tmp/out &
[1] 45576
$ echo 'world'| nc -u 127.0.0.1 8080
^C
[1]  + 45576 suspended (tty input)  nc -lu 8080 > /tmp/out
$ cat /tmp/out
world
```

> 不知道为啥这里不能用 localhost

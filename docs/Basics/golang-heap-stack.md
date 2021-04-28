---
title: Golang的变量是分配在堆中还是栈中？
date: 2021-04-25 11:21:23 GMT+0800
categories: [Basics]
tags: [Golang, C]
---

::: tip
在初始化变量（包括但不限于基础类型变量、数组、结构体）时，Golang 可能在堆上分配，也可能在栈上分配，这取决于编译器优化。
:::

<!-- more -->

## C 语言

C 语言是由编程者控制变量分配位置的。

分配在栈中：

```c
// tmp.c
#include <stdio.h>
#include <unistd.h>

int* f(int tmp) {
  int a = tmp;
  return &a;
}

int main() {
  int* b = f(1);
  f(2);
  printf("b is %d\n", *b);
}
```

```zsh
$ gcc tmp.c -o tmp
tmp.c:6:11: warning: address of stack memory associated with local variable 'a' returned [-Wreturn-stack-address]
  return &a;
          ^
1 warning generated.
$ ./tmp
b is 2
```

::: tip
因为 b 指针指向的是调用`f(1)`时局部变量 a 所在的栈内存地址，所以调用`f(2)`时那个局部变量 a 的位置被赋值为了 2。
如果不是调用`f(2)`而是其他函数的话，b 会更奇怪，因为那个栈地址的值被改成其它玩意儿了。

幸运的是，编译器会在编译时给出警告。
:::

分配在堆中：

```c
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

int* f(int tmp) {
  int* a = (int*)malloc(sizeof(int));
  *a = tmp;
  return a;
}

int main() {
  int* b = f(1);
  f(2);
  printf("b is %d\n", *b);
}
```

```zsh
$ gcc tmp1.c -o tmp1
$ ./tmp1
b is 1
```

::: tip
使用`malloc()`函数在堆中开辟一块 int 空间，`f()`返回的指针指向堆内存地址，所以结果正确。
:::

## Golang

函数返回了局部变量的地址：

```go
// tmp.go
package main

func f() *int {
  a := 1
  return &a
}
```

```zsh
$ go tool compile -m tmp.go
tmp.go:3:6: can inline f
tmp.go:4:2: moved to heap: a # 因为返回值需要&a，返回之后栈就没了，所以a得在堆中分配
```

或者调用了另一个函数，另一个函数将地址赋给了外部变量，该外部变量超过了原函数的生命周期：

```go
// tmp1.go
package main

var g *int

func f() {
  a := 1
  setG(&a)
}

func setG(c *int) {
  g = c
}
```

```zsh
$ go tool compile -m tmp1.go
tmp1.go:10:6: can inline setG1
tmp1.go:5:6: can inline f
tmp1.go:7:7: inlining call to setG1
tmp1.go:6:2: moved to heap: a
tmp1.go:10:12: leaking param: c
```

如果变量的生命周期永远在函数的生命周期之内，就直接在栈上分配：

```go
// tmp2.go
package main

var g *int

func f() {
  a := 1
  setG(&a)
}

func setG(c *int) {
  d := *c
  g = &d
}
```

```zsh
$ go tool compile -m tmp2.go
tmp2.go:10:6: can inline setG
tmp2.go:5:6: can inline f
tmp2.go:7:6: inlining call to setG
tmp2.go:7:6: moved to heap: d # a在栈中分配，因为调用&a的时候，f()还在栈中
tmp2.go:10:11: c does not escape
tmp2.go:11:2: moved to heap: d # d在堆中分配，因为g可能在之后使用，那时候setG()以及结束了
```

还有许多情况。总之，如果变量可能会逃逸出所在函数的作用域，那么就会在堆上分配。
变量不逃逸时直接在栈中分配，方便直接回收。
Golang 的这个机制可以让用户不同操心变量分配到哪里，并且局部变量可以正确使用。

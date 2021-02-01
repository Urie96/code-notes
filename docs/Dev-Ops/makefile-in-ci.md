---
title: 在CI中使用Makefile优化安装依赖步骤
date: 2021-02-01 14:16:55
categories: [Dev-Ops]
tags: [Shell]
---

::: tip
通常，大多语言在 CI 的编译步骤前需要通过命令来安装依赖包，但是项目的依赖很少变化，如果每次都去重新安装依赖的话非常浪费时间与资源。Golang 安装依赖时会自动增量安装，没有新依赖时可以很快结束。但是 Node 安装依赖就比较慢了，一旦运行`npm ci`就删除了当前的依赖包，即使目前版本使用了缓存还是比较慢。
:::

<!-- more -->

::: danger
前提是 CI 一开始就将项目 clone 到一个地方每次只是`git pull`，而不是每次 CI 都重新 `git clone`。
:::

所以自然想到一种办法是判断`package.json`和`package-lock.json`(如果使用的是`npm`)与之前是否有改变，再决定是否安装依赖。

判断是否改变有两种办法：

- 基于内容：安装依赖之后将两个文件的 md5 保存到一个地方，下次安装依赖时检测当前两个文件的 md5 和之前是否一样，不一样才安装依赖。
  > 更加准确，除非运气能好到 md5 出现哈希冲突，判断较慢。
- 基于时间：如果两个文件的修改时间新于`node_modules`，说明需要更新依赖。
  > 更快判断，但有可能很闲地在 package.json 中<kbd>Command</kbd>+<kbd>S</kbd>，就会更新文件时间即使文件内容没变，不过还好 Git 只考虑文件内容，时间变了到 CI 里也不会改变，所以这个问题可以忽略。

比较可得第二种方案更优。Makefile 整好基于时间的方案：

```makefile
# Makefile
OUTPUT=dist
SRC_DIRS=src public

SRC_FILES=$(foreach src,$(SRC_DIRS),$(shell find $(src) -type f -print))

.PHONY: all build install

all: build
  @echo done

build: $(OUTPUT)

$(OUTPUT): node_modules $(SRC_FILES)
  npm run build
  touch $(OUTPUT)

node_modules: package-lock.json package.json
  npm ci
  touch node_modules
```

::: tip NOTES

- `foreach item,list,command`是 Makefile 的命令，command 中可以用环境变量取到 item
- `shell`也是 Makefile 的命令，这样表示后面用的是 shell 命令而不是 Makefile 的
- Makefile 有个命令，`wildcard *.c dir/*.c`可以输出当前文件夹以及 dir 文件夹中所有的 c 文件，不过子文件夹的每层都要写出来，还是用`find`更爽
- `.PHONY`表示假文件，告诉 Makefile 没有这个文件，不用去比较时间了
- `touch`可以更新文件或者文件夹的文件时间
- 命令前加`@`比如上面的`@echo`表示改命令不回显，不然控制台会打印`echo done`这句命令

:::

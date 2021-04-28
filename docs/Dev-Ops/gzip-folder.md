---
title: 文件夹内递归生成 gzip 的 Shell 程序
date: 2020-12-01
categories: [Dev-Ops]
tags: [Shell, Linux]
---

::: tip
编写 Shell 程序，可以生成文件夹内满足给定条件的`*.gz`文件
:::

<!-- more -->

**Background**:

- `gzip -r [dir]`命令会递归地压缩目录下的所有文件，但有些格式的文件并不需要进行处理，而且压缩小文件的意义并不大
- `gzip -r [dir]`命令不会保留源文件，但当 Nginx 接收到不支持 gzip 编码的 HTTP 请求时需要发送未压缩的源文件

**Requirement**:

- 可以正则匹配哪些文件才需要压缩
- 保留压缩前的源文件

**Source Code**:

```bash
match="\.(html|js|css|svg)$"
size=10240

fileSize() {
    local file=$1
    ls -l $1 | awk '{print $5}'
}

shouldGzip() {
    local file=$1
    if [[ ! $file =~ $match ]]; then
        return 1
    fi
    if [ $(fileSize $file) -lt $size ]; then
        return 1
    fi
    return 0
}

gzipFile() {
    local file=$1
    gzip --best -c $file >"$file.gz"
    echo "$file.gz"
}

gzipfolder() {
    local thisDir=$1
    for i in $(ls $thisDir); do
        local abs="$thisDir/$i"
        if [ -f $abs ]; then
            if (shouldGzip $abs); then
                gzipFile $abs
            fi
        elif [ -d $abs ]; then
            gzipfolder $abs
        else
            echo "err: $abs"
        fi
    done
}

gzipfolder "$(pwd)/$1"
```

::: tip

- **match**：正则匹配需要压缩的文件的文件名
- **size**：文件大小大于 size 才压缩
  :::

::: warning
`echo $VAR` 命令会去除多余的空格，应该使用 `echo "$VAR"`
:::

**Usage**: `./gzip.sh public`

::: danger BUG
文件夹名字不能带有空格，不然`for i in $(ls $thisDir)`会将其识别为两个文件夹
:::

## Use Find <Badge text="2021.01.04+" />

发现一个强大的命令 `find` 可以将上面整段代码用一行实现：

```bash
$ find $1 \! -name "*.gz" -type f -size +10k -exec sh -c ' gzip --best -c "$0" > "$0".gz && echo "$0.gz"' {} \;
```

::: tip NOTES

- `-name`可以简单地指定文件后缀。没有用`-regex`来指定正则是因为它不能正确工作，除非在 Mac 中添加`-E`或者在 Linux 中添加`-regextype sed`，总之很奇怪，已经超出了我的探索兴趣；
- `!`否定，特殊字符所以需要`\!`转义。上例中表示排除`*.gz`文件；
- `-type`指定文件类型，f 表示普通文件；
- `-size`指定文件大小，`+10k`表示大于 10kb；
- `-exec`表示对于每个符合的文件执行命令，并且用`{}`占位表示文件的相对路径，并且以`;`结尾。这个命令有个奇怪的点是它只会替换一个命令中第一个`{}`，像`echo {} > {}`这样有两个的话就不会替换第二个`{}`，所以用了`sh -c`命令；
- `sh -c`接收一个字符串，后面的参数作为运行这段字符串的参数；

:::

删除所有`*.gz`：

```bash
$ find $1 -name "*.gz" -type f -exec rm {} \;
```

### 使用匿名管道分工合作 <Badge text="2021.01.07+" />

使用`find`遍历目录查找大于 10k 的文件名，使用`egrep`通过正则过滤文件名，使用`xargs`将文件名转换为命令参数，使用`wc`统计压缩的文件个数：

```zsh
$ find ./dist -type f -size +10k | egrep "\.(js|css|html|svg)$" | xargs -I {} sh -c ' gzip --best -c "{}" > "{}".gz && echo "{}.gz"' | wc -l | xargs -I {} echo "{} files compressed"
54 files compressed
$ find ./dist -type f | egrep "\.gz$" | xargs -I {} sh -c "rm {} && echo {}" | wc -l | xargs -I {} echo "{} files deleted"
54 files deleted
```

---
title: 文件夹内递归生成 gzip 的 Bash 程序
date: 2020-12-01
categories: [Dev-Ops]
tags: [Bash]
---

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

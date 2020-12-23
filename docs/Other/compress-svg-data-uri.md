---
title: 将文件的 Data URI 复制到剪切板
date: 2020-12-01
categories: [Other]
tags: [JavaScript]
---

::: tip
指定文件路径，复制其 data URi 到剪切板，便于粘贴到 HTML 或者 CSS 中
:::

<!-- more -->

## Data URI Format

::: warning
`data:[<mime type>][;base64],<data>`
:::

默认值为`data:text/plain;charset=US-ASCII`

`mime type`：如 jpeg 是 image/jpeg

## Base64

像图片视频这些二进制文件用编辑器打开会乱码，因为编辑器每 8 个比特（也就是一个字节）视为一个字符，但不是所有的字节都是可打印的，所以就会出现乱码。
而 Base64 的目标就是将二进制转为可打印的字符，Base64 选择了`[a-zA-Z0-9+/]`共 64 个字符，也就是 6 个比特的信息。为了能够编解码一一对应，就需要将二进制的每 6 个比特分别对应到这 64 个字符，每个字符占用 8 个比特。也就是说，为了将二进制编码，文件大小增加了 1/3。

## Convert to Base64

JS 中可以使用 String 的`toString('base64')`方法将字符串转为 base64，或者使用 Buffer 的`toString('base64')`方法将二进制转为 base64

## Special SVG

由于 SVG 本来就是文本文件，所以不需要再通过 base64 编码，可以编码为如下格式：

```
data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 50 50'%3e%3cpath d='M22 38V51L32 32l19-19v12C44 26 43 10 38052 15 49 39 22 38z'/%3e%3c/svg%3e
```

首先可以用`svgo`压缩 SVG 文件中冗余的信息，再用`mini-svg-data-uri`转为 URI：

```js
const SVGO = require('svgo');
const svgToUri = require('mini-svg-data-uri');

module.exports = function svgu(svgData) {
  return new SVGO().optimize(svgData).then(({ data }) => ({
    uri: svgToUri(data),
    deuri: data,
  }));
};
```

## Final Code

```js
const clipboardy = require('clipboardy');
const mime = require('mime-types');
const svgu = require('svgu');
const fs = require('fs');

module.exports = function run() {
  const startTime = Date.now();
  const dataPath = process.argv.pop();
  fs.readFile(dataPath, async (err, data) => {
    let res = '';
    if (dataPath.endsWith('svg')) {
      const { uri } = await svgu(data.toString());
      res = uri;
    } else {
      const base64 = data.toString('base64');
      const mimeType = mime.lookup(dataPath);
      res = `data:${mimeType};base64,${base64}`;
    }
    clipboardy.write(res);
  });
};
```

::: tip
可以使用 node 将其加入到全局命令，就可以使用`touri <filePath>`将 URI 复制到剪切板了
:::

---
title: 压缩 SVG 并导出 DataURI
date: 2020-12-01
categories: [Other]
tags: [SVG, JavaScript]
---

## Convert `*.eps` to `*.svg`

- Install [Adobe Illustrator](https://www.adobe.com/cn/products/illustrator.html).
- Open `*.eps` file and select `Import As *.svg`

::: tip Note
Use these options to minify output:

**样式**：内联 CSS  
**小数**：1  
**缩小**：checked  
**响应**：checked
:::

## Minify For Network Transmission

Use [svgo](https://github.com/svg/svgo)

```bash
$ npm install -g svgo
$ svgo *.svg
```

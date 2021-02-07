---
title: TypeScript 声明文件
date: 2021-01-19 11:18:49 GMT+0800
categories: [Front-End]
tags: [TypeScript]
---

## 全局声明文件中使用`import`语句

声明文件有两种：

- node_modules 中导出的声明文件
- 自己在 types 文件夹定义的全局声明文件

当自己定义的全局声明文件顶层有 import 时就失效了，可以改为动态 import 语句。比如：

```ts
declare interface Context {
  request: import('koa').Request & { user: import('../models/user').User };
}
```

::: warning
TS 声明文件只能用于类型定义，在编译后是无感的，无法在业务中使用声明文件的运行时，比如类的 prototype 或者枚举成员等。
:::

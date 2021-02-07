---
title: Hackbook
date: 2020-12-04 17:30:04 GMT+0800
categories: [Projects]
tags: [JavaScript, Node, WebCrawler, SSO, Webpack, Vue, Nginx, Docker]
---

::: tip
[极客时间](https://time.geekbang.org/)及[拉勾教育](https://kaiwu.lagou.com/)两大知识付费平台的所有付费专栏(_仅供个人学习使用_)。
:::

<!-- more -->

## Features

_爬虫部分：_

- **零成本**：寻找漏洞以免费获取付费内容
- **内容丰富**：包含[极客时间](https://time.geekbang.org/)及[拉勾教育](https://kaiwu.lagou.com/)的所有专栏及其简介、目录、评论与评论回复
- **高效**：使用 [SuperAgent](https://github.com/visionmedia/superagent) 替代前端自动化测试框架以获取最高的爬虫效率
- **稳定**：编写异步池以避免网关拒绝服务；模拟多用户以应对反爬策略
- **安全**：编写安全的存储函数保证爬虫测试或后续爬虫不会影响到已爬内容，平滑同步官网更新；爬虫前自动备份已爬内容作为最后一道防线

_前端部分：_

- **组件化**：使用 [Vue](https://cn.vuejs.org/) 组件化开发，应用虚拟 DOM 技术保持浏览器流畅；另一方面，学习流行技术
- **单页**：使用 [Vue Router](https://router.vuejs.org/zh/) 管理路由。使用 [History](https://router.vuejs.org/zh/guide/essentials/history-mode.html) 模式美化 URL；路由跳转时不销毁前页面，避免浏览器前进后退时再发网络请求；监听路由参数保证 URL 更改时重新获取数据
- **美观**：仅使用成熟的 [Element](https://element.eleme.io/) 作为 UI 组件库，保证风格统一
- **懒加载**：使用无限滚动，加载部分专栏，到页面底部时继续获取，减少网络请求，提升浏览体验
- **代码高亮**：如果章节内容存在代码，加载 [highlight.js](https://highlightjs.org/) 以高亮显示代码
- **公式显示**：如果章节内容存在数学公式，加载 [katex](https://katex.org/) 以排版数学公式
- **搜索专栏**：提供搜索功能快速查找所需专栏
- **收藏专栏**：登录后可以对收藏专栏或者取消收藏，主页优先显示收藏的专栏，方便快速进入感兴趣的专栏
- **学习记忆**：主页显示上次学习的专栏，进入目录页面会定位到最后浏览的章节，进入章节页面会定位到最后学习的位置

_后端部分：_

- **简单**：通过 [express](https://expressjs.com/) 可以以极少的代码量引入中间件和搭建后端服务
- **方便**：利用开源的 [json-server](https://github.com/typicode/json-server) 在内存中保存所有专栏、目录、章节等内容，供前端直接以 [RESTful](https://restfulapi.net/) 的方式获取
- **登录**：调用登录接口将用户重定向至 [SSO](https://sso.sweetlove.top) 界面，完成后在后端向 SSO 服务发送请求以验证

## Difficulty

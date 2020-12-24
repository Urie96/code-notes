---
title: Service Worker 与 Work Box 的入门实践
date: 2020-12-24 11:14:37
categories: [Front-End]
tags: [JavaScript]
---

::: tip
Service Worker 可以拦截浏览器的 Fetch 请求，也可以自己发起网络请求，是单独的线程，主要用来主动控制网络请求缓存，提升浏览体验。Work Box 是一套工具，可以方便 地配置 Service Worker。
:::

<!-- more -->

## Service Worker

服务一个静态文件`index.html`，并在`<script>`添加下面代码：

```js
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/service-worker.js');
  });
}
```

查看网络请求可以发现有一条`/service-worker.js`的请求

在同级目录新建`service-worker.js`并添加如下内容

```js
console.log('Hello from service-worker.js');
```

再打开浏览器发现 console 打印出了内容，并且`Application > Service Workers`中注册了上面的 Service Worker

编辑`service-worker.js`:

```js
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('v1').then((cache) => cache.addAll(['/index.html']))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches
      .match(event.request)
      .then((response) => (response ? response : fetch(event.request)))
  );
});
```

打开浏览器的`Application > Service Workers`并激活，切换到 network 面板并刷新，可以发现根请求是由 Service Worker 响应的，并且`Application > Cache Storage`存在 key 为`v1`的缓存，里面存放了`index.html`

::: tip NOTES

- `self`和`caches`是 service worker 的全局变量，注意 service worker 中不能访问 window 对象
- 在上面代码中，如果缓存未命中，会由`fetch()`来发起网络请求，此时 service worker 相当于请求转发的角色，在 network 面板中该请求会出现两次，一次是应用的请求，一次是 service worker 请求的，后者发起的请求会在 network 面板中带有齿轮符号。
- 这里的 fetch 事件可以拦截跨域请求

:::

## Work Box

### CDN

[官方文档](https://developers.google.cn/web/tools/workbox/modules/workbox-sw)

```js
importScripts(
  'https://storage.googleapis.com/workbox-cdn/releases/6.0.2/workbox-sw.js'
);

self.skipWaiting(); // 自动更新最新的service worker

workbox.routing.registerRoute(
  ({ request }) => request.destination === 'image', // 函数返回true就拦截
  new workbox.strategies.CacheFirst() //缓存策略
);
```

::: tip 缓存策略

- **NetworkFirst**：网络失败才使用缓存
- **NetworkOnly**：即使网络失败也不使用缓存（不开启 service worker 不就是这样么，不理解存在意义）
- **CacheFirst**：先使用缓存，缓存未命中就请求网络
- **CacheOnly**：仅缓存不发网络请求
- **StaleWhileRevalidate**：直接使用缓存，并在后台刷新缓存，缓存未命中就等待请求
- 还可以自定义策略

#### Cacheable Response Plugin

:::

为了只缓存成功的响应，需要在向缓存策略传入配置：

```js
workbox.strategies.cacheFirst({
  plugins: [
    new workbox.cacheableResponse.Plugin({
      statuses: [0, 200],
      header: {},
    }),
  ],
});
```

::: warning
status 0 表示跨域请求，所以如果要缓存第三方请求，需要添上
:::

#### PreCache

预缓存用于在 service worker 加载的时候主动发起请求，应用需要的时候就可以直接使用了

```js
workbox.precaching.preacheAndRoute([
  '/styles/index.0c9a31.css',
  '/scripts/main.0d5770.js',
  {
    url: '/index.html',
    revision: '383676',
  },
]);
```

::: tip

- `revision`会在缓存名字的末尾添加上去，如果在 service worker 重新加载时，若 Cache Storage 中已经有了同名同 revision 的缓存，则不会发起网络请求。
- 直接传入字符串意味着只要缓存中存在同名缓存，就一直不会刷新。如果名字中有 hash 值，就可以采用。
- 在 service worker 加载时 Work Box 会删除多余的缓存。

:::

### CLI

Precache 需要 revision，如果靠手工维护几乎不可能，这个命令就是为了计算文件 md5 并导入 service-worker.js

NPM 安装：`npm install workbox-cli --global`

#### Command

- `workbox wizard`：根据提示来生成用于`generateSW`命令的`workbox-config.js`文件
- `workbox generateSW workbox-config.js`：根据配置及静态文件生成`service-worker.js`
- `workbox wizard --injectManifest`：根据提示来生成用于`injectManifest`命令的`workbox-config.js`文件
- `workbox injectManifest workbox-config.js`：根据自己的`service-worker.js`，找到其中的`self.__WB_MANIFEST`，将其替换成一个包含 revision 的数组

### Webpack

有了 work box cli 就可以在代码上线前自动执行生成 service-worker.js，已经相当方便，但如果能够交给 webpack 统一管理就能更方便地进行管理维护。

安装：`npm i -D workbox-webpack-plugin`

配置 webpack：

```js
// webpack.config.js
const { GenerateSW } = require('workbox-webpack-plugin');

module.exports = {
  plugins: [
    new GenerateSW({
      // mode: 'development',
      clientsClaim: true,
      skipWaiting: true,
      exclude: [/\.gz$/],
      runtimeCaching: [
        {
          urlPattern: /https:\/\/(cdn|static001\.geekbang\.org|s0\.lgstatic\.com)/,
          handler: 'CacheFirst',
          options: {
            cacheableResponse: {
              statuses: [0, 200],
            },
          },
        },
        {
          urlPattern: /https?:\/\/[^/]+\/api\/(?!login)/,
          handler: 'StaleWhileRevalidate',
          options: {
            cacheableResponse: {
              statuses: [200],
            },
          },
        },
      ],
    }),
  ],
};
```

::: tip

- `skipWaiting`设置为`true`（默认`false`）可以使浏览器发现`service-worker.js`版本更新可以立即激活。如果需要与用户交互，让用户来选择是否刷新才需要设置为`false`，否则要在标签页关闭之后才能激活
- `clientsClaim`设置为`true`（默认`false`）可以在浏览器第一次加载`service-worker.js`能立即接管
- 设置`mode: 'development'`可以在控制台打印缓存信息
- 如果 webpack 输出的 bundle 名字里已经有 hash 了，work box 不会设置 revision（第一次使用时曾一度怀疑人生）

:::

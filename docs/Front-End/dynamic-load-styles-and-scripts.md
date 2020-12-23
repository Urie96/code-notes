---
title: 动态加载 style 及 script
date: 2020-12-23 15:44:44
categories: [Front-End]
tags: [Javascript, Webpack]
---

::: tip
webpack 打包时一般下会把所有依赖打包到`vendor.js`中，导致这个文件通常比较大，并且如果依赖有更改，整个`vendor.js`也会改变，不利于缓存。所以 webpack 提供了 external 配置，可以不打包指定的依赖，我们就可以在`index.html`中通过 CDN 来加载依赖。但有些依赖并不总是需要的，所以就需要动态地来拉取 CDN。
:::

<!-- more -->

## Load Style

主要思路就是通过 DOM API 在 head 标签内部添加 link 标签，以达到动态加载 CSS 的目的。

```js
function loadStyle(url) {
  const links = document.getElementsByTagName('link');
  for (let i = 0; i < links.length; i++) {
    const s = links[i];
    if (s.getAttribute('href') == url) {
      return;
    }
  }
  const link = document.createElement('link');
  link.href = url;
  link.rel = 'stylesheet';
  document.head.appendChild(link);
}
```

::: tip
为了避免重复加载，需要先判断之前是否已经导入过同样的 link 标签
:::

## Load Script

动态加载 script 会比 style 复杂一些，因为 script 的下载是异步的，如果 script 还没有下载或者执行完毕自己的代码就去尝试调用 script 注册的全局变量，就可能引发空指针报错，所以需要在 script 执行完毕之后通过 Promise 继续执行自己的代码。如下：

```js
function loadScript(url, key) {
  const error = new Error();
  return new Promise((resolve, reject) => {
    if (typeof window[key] !== 'undefined') return resolve();
    loadScriptTag(url, (event) => {
      if (typeof window[key] !== 'undefined') return resolve();
      var errorType = event && (event.type === 'load' ? 'missing' : event.type);
      var realSrc = event && event.target && event.target.src;
      error.message =
        'Loading script failed.\n(' + errorType + ': ' + realSrc + ')';
      error.name = 'ScriptExternalLoadError';
      error.type = errorType;
      error.request = realSrc;
      reject(error);
    });
  }).then(() => window[key]);
}
```

::: tip
url 是 script 所在地址，key 是 script 将注册的全局变量名字。首先判断如果已经存在该全局变量就直接返回 `resole`，否则就调用 `loadScriptTag()` 尝试添加 script 标签。
:::

像 vue 模块在项目中通常被许多其他模块依赖，比如 Vue Router，Element UI 等，所以在项目加载时可能在 vue 的 script 标签添加之后执行完毕之前，后续又被调用尝试加载 Vue，所以需要创建数组，Vue 加载完成之后调用所有的数组。

```js
const loadScriptTag = (() => {
  const inProgress = {};
  // loadScript function to load a script via script tag
  return (url, done) => {
    if (inProgress[url]) {
      inProgress[url].push(done);
      return;
    }
    let script, needAttach;
    const scripts = document.getElementsByTagName('script');
    for (let i = 0; i < scripts.length; i++) {
      const s = scripts[i];
      if (s.getAttribute('src') == url) {
        script = s;
        break;
      }
    }
    if (!script) {
      needAttach = true;
      script = document.createElement('script');
      script.charset = 'utf-8';
      script.timeout = 120;
      script.src = url;
    }
    inProgress[url] = [done];
    const onScriptComplete = (prev, event) => {
      // avoid mem leaks in IE.
      script.onerror = script.onload = null;
      clearTimeout(timeout);
      const doneFns = inProgress[url];
      delete inProgress[url];
      script.parentNode && script.parentNode.removeChild(script);
      doneFns && doneFns.forEach((fn) => fn(event));
      if (prev) return prev(event);
    };
    var timeout = setTimeout(
      onScriptComplete.bind(null, undefined, {
        type: 'timeout',
        target: script,
      }),
      120000
    );
    script.onerror = onScriptComplete.bind(null, script.onerror);
    script.onload = onScriptComplete.bind(null, script.onload);
    needAttach && document.head.appendChild(script);
  };
})();
```

## Webpack

Webpack5 中新增特性 [ExternalType Script](https://webpack.js.org/configuration/externals/#script)，他可以指定哪些模块不打包，而是通过动态加载 script 的方式引入，上面加载 script 的代码也是借鉴了 webpack 中该特性的实现，不过 webpack 并没有提供动态加载 style 的方法。

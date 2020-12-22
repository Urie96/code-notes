---
title: 编写 Webpack Loader 与 Plugin
date: 2020-12-14
categories:
  - Front-End
tags: [Webpack, JavaScript]
---

## Write a Loader

有时候需要提取页面的公共部分，在 js 中通过 import 引入，可以
写一个`html-loader.js`，可以在 JS 中导入 html 文件，并且这个文件可以像 Vue 一样包含`style`和`script`

```js
// html-loader.js
const { minify } = require('html-minifier-terser');

module.exports = (source) => {
  const miniHtml = minify(source, {
    minifyCSS: true,
    minifyJS: true,
    collapseWhitespace: true,
  });
  console.log(miniHtml);
  return `
  const div = document.createElement('div');
  div.innerHTML = ${JSON.stringify(miniHtml)};
  const eles = div.children;
  module.exports = {
    /** @param {HTMLElement} parent */
    appendTo: (parent) => {
      while (div.childElementCount > 0) {
        const ele = div.firstElementChild;
        ele.remove();
        if (ele.tagName === 'SCRIPT') {
          eval(ele.innerHTML);
        } else {
          parent.appendChild(ele);
        }
      }
    },
  };`;
};
```

::: tip Notes

- [html-minifier-terser](https://github.com/terser/html-minifier-terser) 是 [html-minifier](https://github.com/kangax/html-minifier) 的分支版本。后者使用 UglifyJS 作为压缩 script 的工具，对 ES6 的支持不太好并且没有继续维护了，所以作者创建了前者这个分支项目，选择 terser 来压缩 JS
- 这里的 JS 代码是在 webpack 编译阶段运行的，`return`的代码才是被编译后在浏览器中运行的
- 直接使用`document.body = <script>console.log(1)</script>`，内联 script 代码不会运行，而 style 可以，所以改用`eval()`运行 script

:::

配置 webpack：

```js
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.html$/,
        use: ['./webpack/html-loader.js'],
      },
    ],
  },
};
```

例如，我们可以写一个 cover.html，实现封面

```html
<!-- cover.html -->
<style>
  #cover {
    position: absolute;
    top: 0;
    bottom: 0;
    left: 0;
    right: 0;
    z-index: -999;
  }
</style>

<div id="cover"></div>

<script>
  function randomPair(option) {
    const { max, min, minDif } = option;
    const res = [0, 0];
    res[0] = min + Math.floor((max - min) * Math.random());
    res[1] = min + Math.floor((max - min - 2 * minDif) * Math.random());
    if (res[0] - res[1] < minDif) {
      res[1] += 2 * minDif;
    }
    return res;
  }
  const [a, b] = randomPair({
    max: 255,
    min: 0,
    minDif: 60,
  });
  document.getElementById(
    'cover'
  ).style.background = `linear-gradient(to left bottom,hsl(${a},100%,85%) 0%,hsl(${b},100%,85%) 100%)`;
</script>
```

::: tip
这个例子中包含了 `style`，`html`，`script` 三种元素，并且封面背景采用了随机线性渐变
:::

在 js 中使用，所有需要该封面的地方只需要 import 并添加到 dom 即可

```js
// index.js
import cover from './html/cover.html';

cover.appendTo(document.body);
```

## Write a Plugin

编写插件，将所有的汉字转换为 Unicode，避免浏览器直接搜索到

webpack 的插件可以是一个实现 apply 方法的类

```js
const { Compilation } = require('webpack');
const fs = require('fs');
const path = require('path');

module.exports = class ChineseToUnicodePlugin {
  constructor() {
    this.pluginName = 'ChineseToUnicodePlugin';
  }

  /** @param {import('webpack').Compiler} compiler */
  apply(compiler) {
    // before gzip
    compiler.hooks.compilation.tap(this.pluginName, (compilation) => {
      compilation.hooks.processAssets.tap(
        {
          name: this.pluginName,
          stage: Compilation.PROCESS_ASSETS_STAGE_SUMMARIZE,
        },
        (assets) => {
          for (const name in assets) {
            if (name.endsWith('.js')) {
              const result = this.chineseToUnicode(assets[name].source());
              assets[name].source = () => result;
            }
          }
        }
      );
    });

    // after output
    compiler.hooks.afterEmit.tap(this.pluginName, (compilation) => {
      const outputPath = compilation.outputOptions.path;
      fs.readdir(outputPath, (err, files) => {
        files.forEach((name) => {
          if (name.endsWith('.js')) {
            const filePath = path.resolve(outputPath, name);
            fs.readFile(filePath, (_, data) => {
              fs.writeFile(
                filePath,
                this.chineseToUnicode(data.toString()),
                null,
                () => {}
              );
            });
          }
        });
      });
    });
  }

  /** @param {String} str */
  chineseToUnicode(str) {
    return str.replace(/[\u4e00-\u9fa5]/g, this.encodeUnicode);
  }

  encodeUnicode(str) {
    var res = [];
    for (var i = 0; i < str.length; i++) {
      res[i] = ('00' + str.charCodeAt(i).toString(16)).slice(-4);
    }
    return '\\u' + res.join('\\u');
  }
};
```

::: tip Notes

- 没有使用 loader 是因为即使 loader 处理了，后面 Unicode 也会被 webpack 转义为中文。
- 之所以有两次的重复处理，是因为需要同时处理 compression-webpack-plugin 插件输出的 `*.gz` 文件以及直接输出的 `*.js` 文件。
- 通过查看 compression-webpack-plugin 的源码可以得知压缩是在 [processAssets](https://webpack.js.org/api/compilation-hooks/#processassets) 阶段的`PROCESS_ASSETS_STAGE_OPTIMIZE_TRANSFER`阶段进行的，而 webpack 将 Unicode 处理为中文是在之前的`PROCESS_ASSETS_STAGE_OPTIMIZE_SIZE`阶段进行的，所以选择在中间的`PROCESS_ASSETS_STAGE_SUMMARIZE`阶段将中文转换为 Unicode。
- 即使做了上面这条转换，最后输出的依然是中文，所以我继续尝试在 [emit](https://webpack.js.org/api/compiler-hooks/#emit) 阶段(webpack 输出到文件系统之前) 依然不行，我猜测是在写入文件时被写入函数转换了，所以在 [afterEmit](https://webpack.js.org/api/compiler-hooks/#afteremit) 阶段(写入文件之后) 直接修改文件内容。

:::

webpack 配置：

```js
// webpack.config.js
const ChineseToUnicodePlugin = require('./chinese-to-unicode-plugin');
const CompressionPlugin = require('compression-webpack-plugin');

module.exports = {
  plugins: [
    new ChineseToUnicodePlugin(),
    new CompressionPlugin({
      test: /\.(js|css|svg|ttf|html)$/,
      threshold: 1024 * 10,
    }),
  ],
};
```

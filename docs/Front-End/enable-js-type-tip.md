---
title: 在 VS Code 中开启 JavaScript 的类型推导
date: 2020-12-15
categories: [Front-End]
tags: [VSCode, JavaScript]
---

## Type Checking in VS Code

See [official documentation](https://www.typescriptlang.org/docs/handbook/jsdoc-supported-types.html).

e.g.

```js
// webpack.config.js
/** @type {import('webpack').Configuration} */
module.exports = {
  plugins: [],
};

// vue.config.js
/** @type {import('@vue/cli-service').ProjectOptions} */
module.exports = {
  productionSourceMap: false,
  chainWebpack: (config) => {
    config.plugins.delete('prefetch').delete('preload');
  },
};
```

`*.vue`中也可以使用

```html
<!-- HelloWorld.vue -->
<script>
  /** @type {import('vue').ComponentOptions} */
  const exp = {
    props: ['content'],
    watch: {
      content() {
        this.init();
      },
    },
    mounted() {
      this.init();
    },
  };

  module.exports = exp;
</script>
```

这样就可以启动 VS Code 对 JS 的类型推导

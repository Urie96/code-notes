---
title: JS 异步池的实现
date: 2020-12-23 16:23:52
categories: [Other]
tags: [Javascript, WebCrawler]
---

::: tip
由于 JavaScript 异步 IO 的特性，使得它在单线程内就可以并发发起很多条网络请求，但这样不加以限制地发请求可能会造成服务器瘫痪或者网关拒绝服务，所以这里就需要对网络请求的并发度进行控制
:::

<!-- more -->

## Source Code

```js
function asyncPool(routineCount) {
  const todoPool = [];
  let doingCount = 0;
  function handle() {
    if (doingCount >= routineCount || todoPool.length <= 0) return;
    const func = todoPool.shift();
    func().finally(() => {
      doingCount--;
      handle();
    });
    doingCount++;
  }
  return {
    todo(func) {
      return new Promise((resolve, reject) => {
        todoPool.push(() =>
          func()
            .then(resolve)
            .catch(reject)
        );
        handle();
      });
    },
  };
}
```

::: tip
`todo()`返回一个`Promise`可以在调用处很方便地使用`await`
:::

## Test

```js
function sleepMoment() {
  return new Promise((resolve) => {
    setTimeout(resolve, Math.random() * 10000);
  });
}

const { todo } = asyncPool(3);
const todoFunc = [];
for (let i = 0; i < 10; i++) {
  todoFunc.push(async () => {
    console.log(`第${i}项任务开始了`);
    await sleepMoment();
  });
}
todoFunc.forEach(async (func, i) => {
  await todo(func);
  console.log(`第${i}项任务完成了`);
});
// 第0项任务开始了
// 第1项任务开始了
// 第2项任务开始了
// 第1项任务完成了
// 第3项任务开始了
// 第0项任务完成了
// 第4项任务开始了
// 第2项任务完成了
// 第5项任务开始了
// 第4项任务完成了
// 第6项任务开始了
// 第3项任务完成了
// 第7项任务开始了
// 第7项任务完成了
// 第8项任务开始了
// 第5项任务完成了
// 第9项任务开始了
// 第9项任务完成了
// 第6项任务完成了
// 第8项任务完成了
```

::: tip
可以发现，只需要先获取一个异步池并指定并行数量，将一个返回 Promise 的函数用`todo()`包装一下即可完成控制，其他的使用并没有任何变化。
:::

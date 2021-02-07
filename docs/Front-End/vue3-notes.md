---
title: Vue3 Composition API 笔记
date: 2021-01-07 14:37:46 GMT+0800
categories: [Front-End]
tags: [Vue]
---

## `ref(T)`与`reactive(T)`

两个都是响应式变量：

- `ref(T)`

  - 保存了对 T 的赋值引用，可以响应 T 的重新赋值以及 T 的属性修改
  - 需要通过`.value`获取 T
  - T 可以是基本类型以及引用类型

- `reactive(T)`
  - 只能响应 T 的属性修改
  - 可以直接获取 T 的属性
  - T 必须是引用类型

## `toRef()`与`toRefs()`

两个方法都是将一个 reactive 转为 ref：

- `toRefs(reactive(T))`
  - 返回的是 T 的所有属性的 ref 组成的对象，即`{ [K in keyof T]: Ref<T[K]> }`
  - 只有调用方法时 T 已经有的属性
- `toRef<T, K in keyof T>(reactive(T),K)`
  - 需要指定 T 的属性，即使这个属性目前不存在，返回的是`ref<K>`

将 ref 转为 reactive（reactive 失去了对重新赋值的响应）：

```js
const user_ref = ref({ name: 'yr' });
const user_reactive = reactive(user_ref.value);
```

::: tip
在想 watch 某个 reactive 的属性，或者在`setup()`中 return 时需要这些方法。
:::

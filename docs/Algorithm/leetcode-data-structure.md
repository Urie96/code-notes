---
title: LeetCode中链表与树的生成与打印
date: 2020-12-23 10:09:53 GMT+0800
categories: [Algorithm]
tags: [JavaScript]
---

::: tip
在 LeetCode 刷题时链表和树的章节经常会遇到 `ListNode` 或者 `TreeNode` 这两个类，虽然这些不要求实现，但写好算法代码想在本地测一下，或者提交后发现某个测试用例不通过，想在本地调试一下，不可避免地要用测试用例的数组来生成这两个对象，甚至还想以直观的形式在命令行打印出来，所以我就实现了这两个类的生成、迭代器与打印，同时也启动了 VS Code 的类型推导。
:::

<!-- more -->

## ListNode

ListNode 比较简单，首先是 LeetCode 官方的数据结构定义：

```js
class ListNode {
  constructor(val) {
    this.val = val;
    this.next = null;
  }
}
```

可以看出这是一个单向链表。

### `generate()`

先来实现生成方法 `generate()`，测试用例是数组形式，所以需要根据数组来生成链表。由于 JS 的遍历的方便，不仅是数组，顺带实现了根据其它可遍历对象来生成

```js
static generate(arr) {
  const head = new ListNode()
  let p = head
  for (const v of arr) {
    p.next = new ListNode(v)
    p = p.next
  }
  return head.next
}
```

### Iterator

接着实现迭代器，可以将链表转为数组，方便打印

```js
[Symbol.iterator]() {
  let current = this;
  function next() {
    if (current) {
      const value = current.val;
      current = current.next;
      return { value, done: false };
    } else {
      return { done: true };
    }
  }
  return { next };
}
```

::: tip
要实现迭代器，需要对象具有`[Symbol.iterator]`方法，这样就可以通过`[...list]`来展开了。这里使用闭包来保存`next`已经遍历到哪个位置了。
:::

### Test

```js
console.log(...ListNode.generate([1, 2, 3, 4, 5]));
// 1 2 3 4 5
```

## TreeNode

先上 LeetCode 的官方数据结构定义：

```js
class TreeNode {
  constructor(val) {
    this.val = val;
    this.left = null;
    this.right = null;
  }
}
```

一颗简单的二叉树

### `generate()`

测试用例同样是数组，按照从左到右、从上到下的顺序来的，如果是`null`表示树节点为空

```js
static generate(arr) {
    const [first, ...rest] = arr
    const root = new TreeNode(first)
    const queue = [root]
    let p
    let shouldLeft = false
    for (const v of rest) {
        shouldLeft = !shouldLeft
        if (shouldLeft) p = queue.shift()
        if (!v) continue
        const leaf = new TreeNode(v)
        queue.push(leaf)
        if (shouldLeft) {
            p.left = leaf
        } else {
            p.right = leaf
        }
    }
    return root
}
```

### `print()`

在命令行直观地打印一颗树比较难，因为树越高的地方间距越大，所以还需要计算树所在高度，根据其高度来添加不同数量的空格

```js
getMaxDepth() {
    let leftMax = this.left ? this.left.getMaxDepth() : 0
    let rightMax = this.right ? this.right.getMaxDepth() : 0
    return 1 + Math.max(leftMax, rightMax)
}

_toArray() {
    const maxNodeCount = Math.pow(2, this.getMaxDepth()) - 1
    const queue = [this]
    const res = []
    while (res.length < maxNodeCount) {
        const p = queue.shift()
        if (p) {
            res.push(p.val)
            queue.push(p.left, p.right)
        } else {
            res.push(null)
            queue.push(null, null)
        }
    }
    return res
}

print() {
    function enhanceStringLength(str, spacesLength) {
        if (!str) return " ".repeat(spacesLength)
        const beginSpaces = " ".repeat(Math.floor((spacesLength - str.length) / 2))
        const tailSpaces = " ".repeat(spacesLength - beginSpaces.length - str.length)
        return `${beginSpaces}${str}${tailSpaces}`
    }
    function getMaxValueStringLength(root) {
        if (root === null || root === undefined) return 0
        const thisLength = String(root.val).length
        return Math.max(thisLength, getMaxValueStringLength(root.left), getMaxValueStringLength(root.right))
    }
    const maxValueStringLength = getMaxValueStringLength(this)
    const maxDepth = this.getMaxDepth()
    let rowLevel = 1
    const nodes = this._toArray()
    while (rowLevel <= maxDepth) {
        let thisRowStr = ""
        const beginSpaces = " ".repeat(maxValueStringLength).repeat(Math.pow(2, maxDepth - rowLevel) - 1)
        const middleSpaces = " ".repeat(maxValueStringLength).repeat(Math.pow(2, maxDepth - rowLevel + 1) - 1)
        thisRowStr += beginSpaces
        const thisRowNodeCount = Math.pow(2, rowLevel - 1)
        for (let i = 0; i < thisRowNodeCount; i++) {
            thisRowStr += enhanceStringLength(nodes.shift(), maxValueStringLength)
            if (i < thisRowNodeCount) {
                thisRowStr += middleSpaces
            }
        }
        console.log(thisRowStr)
        rowLevel++
    }
}
```

### Test

```js
TreeNode.generate([1, null, 3, 4, 5, null, 7]).print();
//       1
//           3
//         4   5
//          7
```

## LeetCode Plugin In VS Code

::: tip
VS Code 可以使用 LeetCode 插件在本地拉取代码，这样可以方便地进行调试以及类型推导
:::

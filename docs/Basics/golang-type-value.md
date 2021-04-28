---
title: Golang的类型系统与反射
date: 2021-02-24 10:27:30 GMT+0800
categories: [Basics]
tags: [Golang]
---

::: tip
暂未完成
:::

<!-- more -->

## Type 与 Value

Golang 的所有值都具有两种属性：Type 和 Value

```go
type User struct {
  Name string
}

func printTypeAndValue(i interface{}) {
  fmt.Printf("type: %T, value: %v\n", i, i)
}

func main() {
  i := 1
  printTypeAndValue(i)  // type: int, value: 1
  printTypeAndValue(&i) // type: *int, value: 0xc0000160b8
  s := "abc"
  printTypeAndValue(s) // type: string, value: abc
  u := User{"yangr", 0}
  printTypeAndValue(u) // type: main.User, value: {yangr 0}
  m := map[string][]int{
    "a": {1},
  }
  printTypeAndValue(m) // type: map[string][]int, value: map[a:[1]]
}
```

上面的值都不为空，当使用`var`关键字定义时，对于基础数据类型、结构体以及内置引用类型（如 Slice，Array，Map）拥有默认 Value，而对于指针则为 nil

```go
// 省略如上

func main(){
  var i int
  printTypeAndValue(i) // type: int, value: 0
  var p *int
  printTypeAndValue(p) // type: *int, value: <nil>
  var s string
  printTypeAndValue(s) // type: string, value:
  var u User
  printTypeAndValue(u) // type: main.User, value: { 0}
  var m map[string][]int
  printTypeAndValue(m) // type: map[string][]int, value: map[]
}
```

所以，Golang 的结构体被赋值为变量时就在内存中开辟了所需的空间并且设置了零值，空指针错误的确是像字面上是因为指针引起的：

```go
type User struct {
  Name string
  Age  int
}

type Pet struct {
  Age   int
  Owner User
  OwnerPtr *User
}

func main() {
  var p Pet
  fmt.Println(p.Age)          // 0
  fmt.Println(p.Owner.Age)    // 0
  fmt.Println(p.OwnerPtr.Age) // panic: runtime error: invalid memory address or nil pointer dereference
}
```

由上可知，为什么 GORM 的结果赋值函数（`Take()`, `Find()`, `First()`  等）可以传只有类型的切片的指针，但不可以传只有类型的结构体指针，是因为用 var 定义切片时时会在内存中开辟空间并赋零值，而定义指针时不会：

```go
var users []*User
gorm.Find(&users) // ok
user1 := &User{}
gorm.Take(user1) // ok
var user2 *User
gorm.Take(user2) // not work
```

但是 map 又和 slice 不一样，map 的默认零值并不能正常使用而 slice 可以：

```go
func main() {
  s1 := make([]string, 0)
  var s2 []string
  fmt.Println(len(s1))   // 0
  fmt.Println(len(s2))   // 0
  fmt.Println(s1 == nil) // false
  fmt.Println(s2 == nil) // true

  m1 := make(map[string]int)
  var m2 map[string]int
  fmt.Println(reflect.ValueOf(m1)) // map[]
  fmt.Println(reflect.ValueOf(m2)) // map[]
  fmt.Println(len(m1))             // 0
  fmt.Println(len(m2))             // 0
  fmt.Println(m1 == nil)           // false
  fmt.Println(m2 == nil)           // true
  fmt.Println(m1["a"])             // 0
  fmt.Println(m2["a"])             // 0

  s2 = append(s2, "a")
  fmt.Println(s2) // [a]
  m2["a"] = 1 // panic: assignment to entry in nil map
}
```

::: tip

- var 定义的 map 有默认零值 map[]，但是是一个只读的 nil map
- var 定义的 slice 虽然等于 nil，但是和 empty slice 一样是可读可写的

:::

## Reflect

### `reflect.TypeOf(T)`与`reflect.ValueOf(T)`

- `reflect.TypeOf()`获取 T 的 type，`reflect.ValueOf(T)`获取 T 的 value
- value 可以获取其 type，但 type 不可获取其 value
- value 和 type 都有一个方法`Elem()`，用于获取 slice、array、map、chan、ptr 所包含或者指向的 value 或者 type

// TODO

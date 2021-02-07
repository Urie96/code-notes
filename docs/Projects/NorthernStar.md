---
title: Northern Star
date: 2020-12-03 17:32:58 GMT+0800
categories: [Projects]
tags: [Golang, Docker, MicroService, MySQL, gRPC, GORM, Nginx]
---

## Difficulty

### Get Team Assets Amount

最少所需字段的结构体:

```go
type Asset struct{
  SerialNumber string
  EndUserLanID string
  EndUser      *User
}

type User struct{
  LanID         string
  GlobalManager string
}
```

**需求**：经理的主页展示查看自己的团队资产概况（如资产类型饼图）以及直接下属各自的团队资产总数，并且可以点击直接下属以查看他们的资产概况。  
**难点**：统计经理的团队资产需要查找所有下属的资产，下属可能会有多次递归，所以并不好求。

#### Version 1

首先想到的是递归地使用 SQL 查询，比如查找经理 LanID 为`yangr11`的团队资产：

1. 查找直系下属

```sql
SELECT * FROM user WHERE global_manager = "yangr11";
```

2. 分别统计他们的资产

```sql
SELECT * FROM asset WHERE end_user_lan_id = "xxx"
```

3. 递归地查找直接下属的直接下属，完成统计

**问题**：当经理等级较高时，数据库查询过于频繁，经理主页加载极慢。

#### Version 2

考虑到 User 表是每天零点和 LDAP 同步的，系统内不会修改 User 层级关系，所以构建一颗多叉树保存用户层级关系，在需要查找团队成员时直接遍历这颗多叉树，而不用查询 User 表。

```go
type Manager struct {
  LanID         string
  directReports *directReportList
}

type directReportList struct {
  head   *directReportNode
  length int
}

type directReportNode struct {
  directReport *Manager
  next         *directReportNode
}
```

::: tip
多叉树的子节点使用链表而不是切片是为了避免扩容，提高插入效率
:::

将每个节点添加到哈希表，在获取团队根结点时可以不用从树的根结点遍历，将昂贵的时间复杂度转换为廉价的空间复杂度。  
整个哈希表的构建算法如下：

```go
localUserMap := make(map[string]*Manager)
rows := SQL("SELECT lan_id,global_manager FROM user").Rows()
for rows.Next() {
  var lanID, managerLanID string
  rows.Scan(&lanID, &managerLanID)
  var manager *Manager
  if value, exist := localUserMap[lanID]; exist {
    value.LanID = lanID
    manager = value
  } else {
    manager = &Manager{LanID: lanID}
    localUserMap[lanID] = manager
  }
  if name == managerLanID {
    continue
  }
  if value, exist := localUserMap[managerLanID]; exist {
    value.AddDirectReport(manager)
  } else {
    m := &Manager{}
    m.AddDirectReport(manager)
    localUserMap[managerLanID] = m
  }
}
```

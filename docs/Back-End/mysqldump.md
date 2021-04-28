---
title: MySQL 数据备份与导入
date: 2021-01-27 09:56:30 GMT+0800
categories: [Back-End]
tags: [MySQL]
---

# Export

```zsh
$ mysqldump -h localhost -uroot -p [--all-databases] [database] [table1] [table2]  > /tmp/tmp.sql
Enter password:
```

# Import

```zsh
$ mysql -h myserver -p
Enter password:
Welcome to the MySQL monitor.  Commands end with ; or \g.
Your MySQL connection id is 13
Server version: 8.0.23 MySQL Community Server - GPL

Copyright (c) 2000, 2018, Oracle and/or its affiliates. All rights reserved.

Oracle is a registered trademark of Oracle Corporation and/or its
affiliates. Other names may be trademarks of their respective
owners.

Type 'help;' or '\h' for help. Type '\c' to clear the current input statement.

mysql> use hackbook;
Database changed
mysql> source /tmp/tmp.sql;
```

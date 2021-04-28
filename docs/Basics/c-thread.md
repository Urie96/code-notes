---
title: C语言——多线程、互斥锁、条件变量、阻塞队列、线程池
date: 2021-04-26 12:39:43 GMT+0800
categories: [Basics]
tags: [C]
---

## 线程创建函数`pthread_create()`

```c
// thread.c
#include <stdio.h>
#include <pthread.h>

int count = 0;

void* run(void* data) {
  for (int i = 0; i < 10000; i++) {
    count++;
  }
  return NULL;
}

int main(int c, char** v) {
  pthread_t tid1, tid2;

  pthread_create(&tid1, NULL, run, NULL);
  pthread_create(&tid2, NULL, run, NULL);

  pthread_join(tid1, NULL); // 阻塞，直到线程tid1结束，回收线程资源
  pthread_join(tid2, NULL);
  printf("count is %d\n", count); // count is 13697
}
```

## 互斥锁`pthread_mutex_t`

```c
// thread-mutex.c
#include <stdio.h>
#include <pthread.h>

int count = 0;
pthread_mutex_t mutex;

void* run(void* data) {
  for (int i = 0; i < 1000000; i++) {
    pthread_mutex_lock(&mutex);
    count++;
    pthread_mutex_unlock(&mutex);
  }
  return NULL;
}

int main(int c, char** v) {
  pthread_t tid1, tid2;
  pthread_mutex_init(&mutex, NULL); // 初始化mutex
  pthread_create(&tid1, NULL, run, NULL);
  pthread_create(&tid2, NULL, run, NULL);
  pthread_join(tid1, NULL);
  pthread_join(tid2, NULL);
  pthread_mutex_destroy(&mutex); // 回收 mutex
  printf("count is %d\n", count); // count is 2000000
}
```

::: tip
经过我的简单验证，C 语言的互斥锁与 Golang 一致，即不可重入、与线程无关（线程 A 上锁后可以被线程 B 解锁）。
:::

## 条件变量`pthread_cond_t`

`pthread_cond_wait()`函数应在`pthread_mutex_lock()`与`pthread_mutex_unlock()`之间调用。调用时会阻塞，并且释放互斥锁，当收到`pthread_cond_signal()`发出的信号时，`pthread_cond_wait()`再获取互斥锁，获取成功后返回。

`pthread_cond_signal()`函数不会阻塞，如果调用时没有线程处于`pthread_cond_wait()`阻塞中，信号就白发了，即使之后有线程调用`pthread_cond_wait()`也不会收到之前的信号。

线程交替执行的一个例子：

```c
// thread-mutex.c
#include <stdio.h>
#include <stdlib.h>
#include <pthread.h>
#include <stdbool.h>

int count = 0;
pthread_mutex_t mutex;
pthread_cond_t cond;
bool should_next_handle_odd = true;

void* even_thread(void* data) {
  bool should_this_thread_handle_odd = (bool)data; // 根据参数决定此线程是处理奇数还是偶数
  int i = should_this_thread_handle_odd ? 1 : 2; // 奇数从1开始处理，偶数从0开始处理
  while (i <= 10000) {
    pthread_mutex_lock(&mutex);
    while (should_this_thread_handle_odd != should_next_handle_odd) { // 判断是否该本线程处理
      pthread_cond_signal(&cond); // 通知另一个线程处理，避免出现死锁
      pthread_cond_wait(&cond, &mutex); // 阻塞，直到收到信号并且得到互斥锁
    }
    if (i - count != 1) { // 判断线程是否是交替执行的
      printf("error\n");
      exit(1);
    }
    count++;
    should_next_handle_odd = !should_next_handle_odd;
    pthread_cond_signal(&cond); // 通知另一个线程处理
    pthread_mutex_unlock(&mutex);
    i += 2;
  }
  return NULL;
}

int main() {
  pthread_t tid1, tid2;
  pthread_mutex_init(&mutex, NULL);
  pthread_cond_init(&cond, NULL);
  pthread_create(&tid1, NULL, even_thread, (void*)true);
  pthread_create(&tid2, NULL, even_thread, (void*)false);
  pthread_join(tid1, NULL);
  pthread_join(tid2, NULL);
  pthread_cond_destroy(&cond);
  pthread_mutex_destroy(&mutex);
  printf("%d\n", count); // 10000
}
```

## 阻塞队列

阻塞队列的简易实现，队列使用链表方便扩容，多线程通过互斥锁控制对队列的并发访问，通过条件变量完成线程间同步。

`block_queue_pop()`从队列中取出元素，如果队列为空，则阻塞线程。

`block_queue_push()`向队列添加元素，添加完成后通过条件变量通知阻塞在`block_queue_pop()`的线程进行消费。

```c
// block_queue.c
#include <pthread.h>
#include <stdio.h>
#include <stdlib.h>
#include <unistd.h>

typedef struct _node {
  void *data;
  struct _node *next;
} linked_node;

linked_node *make_linked_node(void *data) {
  linked_node *node = malloc(sizeof(linked_node));
  node->data = data;
  node->next = NULL;
  return node;
}

typedef struct {
  linked_node *head;
  linked_node *tail;
  pthread_mutex_t mutex;
  pthread_cond_t cond;
} block_queue;

block_queue *make_block_queue() {
  block_queue *queue = malloc(sizeof(block_queue));
  queue->head = make_linked_node(NULL);
  queue->tail = queue->head;
  pthread_mutex_init(&queue->mutex, NULL);
  pthread_cond_init(&queue->cond, NULL);
  return queue;
}

void block_queue_push(block_queue *queue, void *data) {
  linked_node *node = make_linked_node(data);
  pthread_mutex_lock(&queue->mutex);
  queue->tail->next = node;
  queue->tail = node;
  pthread_cond_signal(&queue->cond);
  pthread_mutex_unlock(&queue->mutex);
}

void *block_queue_pop(block_queue *queue) {
  pthread_mutex_lock(&queue->mutex);
  while (queue->head->next == NULL) { // 队列已空，暂停消费，等待生产者发出信号
    pthread_cond_wait(&queue->cond, &queue->mutex);
  }
  // 直接后移头节点，如果是将原头节点的next后移，那么如果next指向null，头节点就与尾节点断链了
  linked_node *head = queue->head;
  linked_node *node = head->next;
  queue->head = node;
  pthread_mutex_unlock(&queue->mutex);
  free(head); // 释放头节点
  return node->data;
}

void *run(void *data) {
  block_queue *queue = (block_queue *)data;
  sleep(2); // 延迟2s向队列添加元素
  block_queue_push(queue, 4);
  return NULL;
}

int main() {
  block_queue *queue = make_block_queue();
  pthread_t tid;
  pthread_create(&tid, NULL, run, (void *)queue);

  block_queue_push(queue, 1);
  block_queue_push(queue, 2);
  printf("%d\n", block_queue_pop(queue));
  printf("%d\n", block_queue_pop(queue));
  block_queue_push(queue, 3);
  printf("%d\n", block_queue_pop(queue));
  printf("%d\n", block_queue_pop(queue)); // 阻塞，直到另一个线程向队列添加了元素
}
```

```zsh
$ ./block_queue
1
2
3
# after 2s
4
```

## 线程池

线程创建开销较大，通过线程池，可以预先创建大量空闲线程，当任务到来时可以立即由线程处理（而不是现创建线程），处理结束后等待新任务到来（而不是回收线程资源）。

通过阻塞队列实现：

```C
// ./thread-pool.c
#include "block_queue.h" // 关于block_queue的函数见上方

void *execute(void *data) {
  printf("thread %d: start\n", pthread_self());
  block_queue *blockQueue = (block_queue *)data;
  while (1) {
    void *data = block_queue_pop(blockQueue);
    printf("thread %d: task %d start\n", pthread_self(), (int)data);
    sleep(2); // 模拟2s处理任务
    printf("thread %d: task %d over\n", pthread_self(), (int)data);
  }
  return NULL;
}

int main() {
  block_queue *queue = make_block_queue();
  for (int i = 0; i < 3; i++) {
    pthread_t tid;
    pthread_create(&tid, NULL, execute, (void *)queue);
  }
  sleep(1);
  for (int i = 1; i <= 6; i++) {
    block_queue_push(queue, i);
    printf("main pushed task %d\n", i);
  }
  sleep(600000);
}
```

```zsh
$ ./thread-pool
thread 23670784: start # 子线程阻塞在block_queue_pop()
thread 22597632: start
thread 23134208: start
# 主线程sleep 1s
main pushed task 1
main pushed task 2
thread 23670784: task 1 start
thread 22597632: task 3 start # 肯定是主线程先推送了任务3，只是子线程打印在了主线程之前
main pushed task 3
main pushed task 4
main pushed task 5
main pushed task 6
thread 23134208: task 2 start
# 子线程处理任务2s
thread 23670784: task 1 over
thread 23670784: task 4 start
thread 22597632: task 3 over
thread 22597632: task 5 start
thread 23134208: task 2 over
thread 23134208: task 6 start
# 子线程处理任务2s
thread 23670784: task 4 over
thread 22597632: task 5 over
thread 23134208: task 6 over
```

::: tip
经过简单测试，每创建一个线程，内存多消耗 8k。
:::

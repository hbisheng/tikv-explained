# TiKV 705: YATP Internals

YATP is a thread pool and cooperative asynchronous task executor used by TiKV. To understand its metrics and queues, start with the difference between a process, a thread, and a task.

## Processes, Threads, and Tasks

A process owns an address space: its heap, mapped files, and other memory. A process can contain multiple threads.

Threads in one process share that address space, but each thread has its own execution stack and CPU register state. Switching from one thread to another does not need to replace the whole virtual address space; the operating system mainly switches the execution state of the thread.

The operating system schedules runnable threads onto CPUs. More runnable threads can increase a process's opportunity to run under fair scheduling, but they do not create more CPU capacity. CPU cores and cgroup quotas still limit the total work that can run at once.

A **task** is smaller than a thread. It is a unit of application work that a thread pool can run on any of its worker threads.

## What a Thread Pool Does

A thread pool creates a fixed number of worker threads. Tasks enter queues, and workers repeatedly take tasks from those queues and run them.

```text
submitted tasks
      |
      v
task queue or queues
      |
      +----> worker thread 1
      +----> worker thread 2
      +----> worker thread N
```

The number of workers is important, but the queueing policy is also important. It decides which task a worker picks next and whether work can move between workers.

## Cooperative, Not Preemptive

YATP schedules tasks in user space. It cannot interrupt a task in the middle of ordinary code and force another task to run.

Instead, tasks yield cooperatively. In Rust async code, a task yields when its future returns `Pending`. A non-blocking I/O operation can do this while it waits for data. When the data becomes ready, the task is notified and scheduled again.

A blocking operation does not yield to YATP while it is running. A long CPU-bound loop has the same effect: it monopolizes one worker until it returns or explicitly reaches an async yield point.

```text
poll task
   |
   +-- ready: finish
   |
   +-- pending: return worker to the pool
                 task waits for a future wake-up
```

This is the core limitation of a cooperative executor: latency depends on tasks yielding often enough.

## The Unified Read Pool

TiKV's unified read pool has a number of worker threads. It runs read tasks from both the coprocessor and the Storage gRPC API, such as `Get` and `BatchGet`.

```text
Get / BatchGet requests ---\
                           +--> unified read pool --> worker threads
coprocessor scan requests -/
```

This is different from the reads performed inside a transaction prewrite. A prewrite must inspect the `lock` CF and `write` CF to check for locks and write conflicts. That work belongs to the transaction scheduler path, not to a client read request handled by the unified read pool.

## Queueing Strategies

YATP supports several ways to choose the next ready task.

### Single-Level Pool

Each worker has a queue. Workers can steal tasks from one another when their own queue is empty. This spreads work without a global priority policy.

### Multi-Level Pool

Tasks are placed in levels. Higher levels receive shorter and more frequent time slices to favor latency. Lower levels receive longer, less frequent slices so that background work still makes progress instead of starving.

### Priority Pool

A priority pool has a global ordering by task priority. Workers take the highest-priority ready task first.

The queue type changes how ready tasks are selected. It does not change the cooperative rule: once a worker starts polling a task, that task must yield before the worker can run something else.

## YATP Task States

At the executor level, a task moves through a small state machine:

```text
NOTIFIED -> POLLING -> IDLE
    ^                    |
    |------- waker -------|
```

1. A newly submitted task is `NOTIFIED` and waits in a queue.
2. A worker takes it and marks it `POLLING`.
3. If the future finishes, the task is complete. If it returns `Pending`, the task becomes `IDLE`.
4. The executor gives the future a waker. When the future can make progress again, the waker marks it `NOTIFIED` and puts it back into a queue.

The different pool types only change how `NOTIFIED` tasks are selected by workers.

## Pool Choice Depends on Version and Configuration

TiKV's pool layout has changed over time. The exact choice depends on the TiKV version, whether the unified read pool is enabled, and whether resource control is enabled. Check the running configuration before diagnosing a production cluster.

The following layouts are useful examples:

| Version family | Coprocessor read pool | Scheduler worker pool | Storage read pool |
|---|---|---|---|
| v6.5 | Unified pool uses `multi_level_pool`; otherwise separate low/normal/high single-level pools | `single_level_pool` | Unified `ReadPool` when enabled; otherwise a single-level pool |
| v7.5 | Unified pool uses `priority_pool` with resource control, otherwise `multi_level_pool`; otherwise separate cop pools | `priority_pool` with resource control, otherwise two single-level pools | Unified `ReadPool` when enabled; otherwise three single-level pools |
| v8.5 | Same general selection as v7.5 | Same general selection as v7.5 | Same general selection as v7.5 |

The old separate pools are commonly named `cop-low`, `cop-normal`, `cop-high`, `store-read-low`, `store-read-normal`, and `store-read-high`.

## Reading Unified Read-Pool Metrics

CPU utilization alone is not enough to diagnose a thread pool. A pool can be full for a few seconds and still look moderate in a metric averaged over a longer sampling window.

### Time Used by Level

This reports worker time used by each scheduling level over the sampling window. With 12 worker threads, the pool can use at most about 12 seconds of worker time per wall-clock second. Sustained values near that limit mean tasks will start waiting for workers.

Short bursts of full utilization can disappear in the average, so this metric is best for sustained saturation, not brief spikes.

### Running Tasks

This is the number of tasks running when the metric is sampled. It is not the number of tasks completed per second. To inspect throughput, use the `count` of task execution-duration observations.

### Wait Duration

This records how long a task waited for a worker rather than executing. It is recorded when the task finishes.

### One Time Slice

This is the duration of one poll of a task. A task can have several time slices because a future may return `Pending` and later be scheduled again.

### Task Execute Duration and Schedule Times

Task execute duration is the task's active execution time. Total task latency also includes time spent waiting in queues. Task schedule times counts how many times the executor polled the task.

## A Missing Signal

A direct metric for time spent with every worker busy would reveal short saturation periods that windowed averages can hide. It is a useful improvement target when brief read-pool queueing causes latency spikes without a clear sustained CPU signal.

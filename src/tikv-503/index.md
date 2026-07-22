# TiKV 503: Coprocessor Introduction

TiKV can perform some query work on behalf of TiDB. This is called **pushdown computation** or the **coprocessor** path.

For example, consider a query that needs a count of rows matching a condition. TiDB could fetch every matching row from TiKV and count them itself. Instead, it can ask TiKV to scan the data, apply the condition, compute the count locally, and return only the result.

```text
without pushdown: TiKV -> matching rows -> TiDB -> count
with pushdown:    TiKV -> count -> TiDB
```

This makes coprocessor work a read-heavy path: it reads data from TiKV, performs computation over those reads, and returns query results to TiDB.

## One Task per Data Range

TiDB divides a coprocessor request into tasks, usually one task for each Region or Region bucket that contains relevant data. The tasks can run in parallel because each one reads a different key range.

Each coprocessor request goes directly into TiKV's read pools.

Before reading data, TiKV obtains a **snapshot**. Every read in that task uses the same snapshot, so the scan and computation observe one consistent view of the data.

```text
TiDB
  |
  +--> cop task for Region A -> snapshot -> scan and compute
  +--> cop task for Region B -> snapshot -> scan and compute
  +--> cop task for Region C -> snapshot -> scan and compute
  |
  v
combine results
```

## Executors Form a Pipeline

TiDB describes the work as a directed acyclic graph, or **DAG**, of executors. A common pipeline looks like this:

```text
scan -> filter -> aggregate -> TopN -> limit
```

The outer executor pulls results from the executor below it. That pull travels down the chain until the scan executor performs the actual key-value reads from RocksDB. Rows then flow back up through filtering, aggregation, sorting, and limiting.

This is the high-level coprocessor model: TiDB creates range tasks, TiKV reads one snapshot per task, executors process the data close to storage, and TiDB combines the task results.

Query time in TiDB is the wall time for the whole query. It can include multiple coprocessor tasks running in parallel, so it is not the duration of one individual TiKV task.

The table and index scans behind these tasks are introduced in [TiKV 605: Coprocessor Operators](../tikv-605/index.md).

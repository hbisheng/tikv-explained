# TiKV 404: Transaction Intro

A **transaction** is a group of reads and writes that must be treated as one logical action. For example, transferring money between two accounts must either update both balances or leave both unchanged. Other transactions must not see a half-finished transfer.

Transactions may run at the same time. When they do, the database needs a rule for what each transaction is allowed to see. This rule is called the **isolation level**.

TiDB's `REPEATABLE READ` behavior is based on **snapshot isolation**. Under snapshot isolation, a transaction reads from one consistent snapshot of committed data. Changes committed by other transactions later do not change what it sees.

## A Stable Read View

When a transaction begins, TiDB gets a timestamp from PD called `start_ts`. This identifies the snapshot the transaction reads from.

When the transaction commits, TiDB gets another timestamp called `commit_ts`. This determines when its writes become visible to other transactions.

```text
Transaction A                         Transaction B
begin
start_ts = 10
                                      begin
                                      start_ts = 12

read snapshot at 10
                                      update the key
                                      commit
                                      commit_ts = 18

read snapshot at 10

commit
commit_ts = 24
```

Although Transaction B commits at timestamp 18, Transaction A continues reading the snapshot at timestamp 10. When Transaction A eventually commits, its own writes become visible at timestamp 24.

This choice creates a requirement for TiKV: it must still be able to return the version visible at `start_ts`, even when newer versions have already been committed.

## Keeping Key History

TiKV does this with **MVCC**, or Multi-Version Concurrency Control.

The basic idea is simple: instead of keeping only the latest value of a key, TiKV keeps multiple committed versions.

```text
balance
  commit_ts 8  -> 100
  commit_ts 15 -> 80
  commit_ts 21 -> Delete
```

To read at a particular timestamp, TiKV chooses the newest version whose `commit_ts` is not greater than the read timestamp.

```text
read_ts 12 -> 100
read_ts 18 -> 80
read_ts 25 -> key not found
```

A delete adds a `Delete` record. It does not immediately remove the older history, because an older snapshot may still need it.

## Committing Across Regions

MVCC gives a transaction a stable read view. A separate problem remains: how can one transaction update several keys as one logical action?

Those keys may belong to different Regions. Each Region has its own Raft group, so no single Raft command can commit all of the writes together.

TiKV's basic transaction protocol follows the **Percolator model**.
TiDB coordinates the operation and chooses one written key as the transaction's **primary**. The primary records the transaction's final outcome; the remaining keys are **secondaries**. This is a transaction-protocol role, not necessarily a table's SQL primary key.

> Percolator model: Prewrite all keys, choose one key as the primary, then commit the primary before the secondary keys.

```text
TiDB
  |
  | prewrite(start_ts)
  +----> primary key
  +----> secondary keys
  |
  | commit primary(commit_ts)
  +----> primary key
  |
  | commit remaining keys
  +----> secondary keys
```

### Phase 1: Prewrite

TiDB groups the mutations by Region and sends prewrite requests to the relevant TiKV peers.

For each key, TiKV checks whether the write can proceed, stores the new value, and places a **transaction lock** on the key.

The lock means that this key has a pending write from the transaction identified by `start_ts`. The transaction's primary key records its final outcome.

There is no committed write record yet, so readers do not treat the new value as committed.

The transaction can proceed only after all of its prewrites succeed. Otherwise, it rolls back.

If any prewrite fails, TiDB rolls back the keys that were already prewritten. A rollback removes the pending lock and value, and records that the transaction's `start_ts` was rolled back.

### Phase 2: Commit

If every prewrite succeeds, TiDB obtains `commit_ts` from PD and commits the primary key first.

Committing a key does two things:

```text
remove its transaction lock
add a committed version at commit_ts
```

Once the primary key has committed, the transaction's outcome is committed. TiDB then commits the secondary keys using the same commit_ts.

## Persisting the Transaction State

`Prewrite` and `commit` are separate requests. After prewrite finishes, TiKV must remember that the value exists but has not yet committed.

This state cannot live only in memory. TiKV persists it in RocksDB:

### Three Column Families

TiKV stores transaction data in three RocksDB column families:

```text
default CF
  (key, start_ts) -> value

lock CF
  key -> { start_ts, primary }

write CF
  (key, commit_ts) -> { kind, start_ts }
```

The `default` CF stores the value written by the transaction.

It uses `start_ts` because TiKV stores the value during prewrite, before the transaction has a `commit_ts`.

The `lock` CF stores pending writes. Its record identifies the transaction and points to its primary key.

The `write` CF stores committed history. A write record says whether the version is a `Put` or `Delete`, when it committed, and which `start_ts` identifies its value in the `default` CF.

The two phases now map directly to the column families:

```text
Prewrite

default CF <- store value
lock CF    <- store transaction lock


Commit

lock CF    <- remove transaction lock
write CF   <- add committed version
```

## Reading at a Timestamp

For each key, versions in the `write` CF are ordered from newer to older.

To read a key at `read_ts`, TiKV finds the newest committed version whose `commit_ts` is no greater than `read_ts`.

For example:

```text
write CF

(balance, commit_ts 21) -> { Delete }
(balance, commit_ts 15) -> { Put, start_ts 9 }
(balance, commit_ts 8)  -> { Put, start_ts 3 }
```

A read at timestamp 18 skips the version committed at 21 and selects the version committed at 15.

That write record points to `start_ts = 9`, which TiKV uses to find the value:

```text
default CF

(balance, start_ts 9) -> 80
```

The read therefore returns 80.

If the selected write record is a Delete, the key does not exist in that snapshot.

Before reading the committed version, TiKV also checks the `lock` CF for a pending transaction that affects the read.

[TiKV 606: Transaction Scheduler](../tikv-606/index.md) covers transaction command execution, latches, and lock resolution in more detail.

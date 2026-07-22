# TiKV 404: Transactions

A transaction is a group of reads and writes that must be treated as one logical action. For example, transferring money between two accounts must either update both balances or leave both unchanged. Other transactions must not see a half-finished transfer.

TiDB turns a SQL transaction into reads and writes against TiKV. Those keys may belong to different Regions. TiKV must give the transaction a stable view for its reads, then make all of its writes commit or roll back together.

## A Stable Read View

Data can change while a transaction is running. A transaction therefore needs a fixed point in history from which to read. TiDB's `REPEATABLE READ` behavior uses **snapshot isolation**: a transaction reads the versions that were committed when it began, even if other transactions commit later.

When a transaction begins, TiDB gets a timestamp from PD called `start_ts`. Ordinary reads use this timestamp to select visible versions.

```text
Transaction A                         Another transaction

begin
start_ts = 10
                                      commits changes at timestamp 18
read the snapshot at 10
                                      
commit
commit_ts = 24
```

Transaction A continues to read the state at timestamp 10. When it commits, TiDB obtains `commit_ts`. Its writes become visible to transactions reading at timestamp 24 or later.

The two timestamps have different jobs:

- `start_ts` identifies the transaction's read snapshot.
- `commit_ts` determines when its writes become visible.

These are TiKV's logical MVCC timestamps. They are separate from the internal sequence numbers used by [RocksDB](../tikv-403/index.md) for its local versioning.

## Keeping Key History

**MVCC**, or Multi-Version Concurrency Control, keeps enough committed history to reconstruct an older snapshot. A new write does not immediately erase the previous committed version.

```text
balance
  commit_ts 8  -> 100
  commit_ts 15 -> 80
  commit_ts 21 -> Delete
```

The value visible to a read depends on its timestamp:

```text
read_ts 12 -> 100
read_ts 18 -> 80
read_ts 25 -> key not found
```

A delete adds a `Delete` record. It does not immediately remove the older history, because an older snapshot may still need it.

## Three Column Families

TiKV keeps transaction data in three RocksDB column families. A column family is a separate key-value space inside the same RocksDB database.

```text
write CF
  (key, commit_ts) -> { kind, start_ts, short_value? }

default CF
  (key, start_ts)  -> value

lock CF
  key              -> { start_ts, primary, ttl, short_value? }
```

The `write` CF contains committed history. Each record describes a `Put`, `Delete`, or another transaction event, and points back to the transaction's `start_ts`.

The `default` CF stores values that are too large to place directly in a write record. These values use `start_ts` because TiKV stores them during prewrite, before a `commit_ts` exists.

The `lock` CF contains writes that have started but have not yet committed or rolled back.

## Reading at a Timestamp

TiKV encodes timestamps in descending order. For one user key, newer versions therefore appear before older versions. To read at `read_ts`, TiKV finds the newest committed version whose `commit_ts` is no greater than `read_ts`.

Conceptually, a read works like this:

```rust
fn get(key, read_ts) -> Option<Value> {
    check_lock(key, read_ts);

    let write = seek_visible_write(key, read_ts)?;

    match write.kind {
        Put => write.short_value
            .or_else(|| default_cf.get((key, write.start_ts))),
        Delete => None,
    }
}
```

Before reading the committed history, TiKV checks the `lock` CF. A conflicting lock means another transaction has prepared a write to this key but has not finished. TiKV cannot simply ignore it.

## Latches and Locks

TiKV uses both latches and locks, but they solve different problems:

```text
latch  -> in memory, held while one command is processed
lock   -> persisted in lock CF until the transaction finishes
```

A latch briefly serializes commands operating on the same key inside TiKV. It is released when the command finishes.

A transaction lock remains after the request returns. It connects separate requests in the transaction protocol, such as prewrite and commit.

## Committing Across Regions

A transaction may modify keys in several Regions. No single Raft group owns all of them, so TiDB uses **two-phase commit**, or 2PC, to make the transaction reach one outcome.

TiDB coordinates the operation and chooses one written key as the transaction's **primary**. The remaining keys are **secondaries**. This primary is part of the transaction protocol; it is not necessarily a table's SQL primary key.

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

For each key, TiKV checks for conflicts. If the prewrite succeeds, TiKV stores:

```text
lock CF
  key -> { start_ts, primary, ttl, ... }

default CF
  (key, start_ts) -> value
```

A short value may be stored directly in the lock instead of the `default` CF. There is no committed write record yet, so readers do not treat the new value as committed.

If any prewrite fails, TiDB rolls back the keys that were already prewritten. A rollback removes the pending lock and value, and records that the transaction's `start_ts` was rolled back.

### Phase 2: Commit

If every prewrite succeeds, TiDB obtains `commit_ts` from PD and commits the primary key first.

For that key, TiKV performs this conceptual update:

```text
delete lock CF[key]

put write CF[(key, commit_ts)] =
    { kind, start_ts, short_value? }
```

The write record makes the version visible to transactions reading at or after `commit_ts`.

Once the primary commit succeeds, the transaction has a committed outcome. TiDB can return success and commit the secondary keys afterward. Committing each secondary adds its write record and removes its lock.

## Resolving an Unfinished Transaction

TiDB may disappear after prewrite and leave locks behind. Each lock records the transaction's primary key and a time-to-live value, or `ttl`.

A later request that encounters such a lock checks the primary:

```rust
let status = CheckTxnStatus(primary, start_ts);

match status {
    Committed(commit_ts) => ResolveLock(start_ts, commit_ts),
    RolledBack           => ResolveLock(start_ts, rollback),
    Uncommitted          => wait_or_retry(),
}
```

If the primary committed, the secondary locks can also be committed. If the primary rolled back, the secondaries are rolled back. If the primary is still locked but its TTL has expired, `CheckTxnStatus` can roll it back before resolving the secondary locks.

This lets the transaction reach a final state even when the original TiDB coordinator is gone.

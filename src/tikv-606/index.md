# TiKV 606: Transaction Scheduler

[TiKV 404](../tikv-404/index.md) described the data that a transaction leaves in the `write`, `default`, and `lock` column families. This chapter follows one transaction command: how TiKV checks whether it is allowed to write, then turns it into those column-family changes.

## A Prewrite Is a Promise to Write

Suppose TiDB starts a transaction at `start_ts = t0` and wants to make two changes:

```text
Set(key_A) = value_1
Set(key_B) = value_2
```

TiDB cannot commit either key yet because the keys may belong to different Regions. It first sends **prewrite** requests. A successful prewrite means: this transaction has checked the key and reserved its intent to write it. The actual commit comes later through 2PC.

## Why a Write Command Must Read

A prewrite cannot blindly add a new lock. Before it does, TiKV must answer two questions:

1. Is another transaction still working on this key?
2. Did another transaction commit a newer version after this transaction started?

The first answer comes from the `lock` CF. A lock means an earlier transaction has prewritten the key but has not finished. The new transaction must wait, resolve that lock, or fail instead of writing over it.

The second answer comes from the `write` CF. It contains committed versions and their commit timestamps.

```text
initial balance: 100

Transaction A: start_ts = 10, plans to write balance = 90
Transaction B: start_ts = 12, plans to write balance = 80

Transaction B commits at commit_ts = 15
Transaction A prewrites and sees commit_ts 15 > start_ts 10
```

Transaction A must abort. If it were allowed to write 90 afterward, it would overwrite B's change using an older view of the balance. Snapshot isolation still needs this write-conflict check to prevent a lost update.

## Latches Serialize Local Commands

Several TiKV requests can reach the same key at once. Before a transaction command reads or writes that key, it takes an in-memory **latch**.

A latch is based on a key hash. TiKV has 512K hash slots by default. A command hashes all of its keys, tries to acquire their latches in a fixed order, and waits when another command already owns a conflicting latch.

```text
keys in one command
      |
      v
hash each key
      |
      v
acquire latches in order
      |
      v
read MVCC state and prepare mutations
```

The slots use 64-bit hashes, so collisions are rare. A slot can still let tasks with different hashes proceed; it serializes only tasks with the same hash. When a task finishes, it wakes the next waiting task for that hash.

Latches exist only in memory and are released when the command finishes. They are different from transaction locks, which are persisted in the `lock` CF and can remain between prewrite and commit.

## From Checks to Column-Family Changes

After the command holds its latches, it reads the `lock` CF and `write` CF, performs conflict checks, and prepares the changes for Raftstore.

For a successful prewrite, the important output is:

```text
lock CF
  key -> { start_ts, primary, ttl, ... }

default CF
  (key, start_ts) -> value
```

The scheduler packages these modifications into a Raftstore write. Raftstore replicates and commits them before they become durable Region state, as described in [TiKV 501](../tikv-501/index.md).

## Optimistic and Pessimistic Locking

An optimistic transaction discovers conflicts when it prewrites. It may have already done substantial work before learning that it must retry.

A pessimistic transaction takes persistent locks earlier. Other writers then wait or fail before they can create a conflicting write. This reduces late rollbacks when several transactions are likely to update the same keys.

Both modes still use the same basic pieces: latches serialize local command execution, while persisted locks coordinate transactions across requests and Regions.

## Slow Transactions Create Resolve-Lock Work

A lock remains until the transaction commits or rolls back. If a TiKV store is slow, or its TiDB coordinator is slow, locks remain visible for longer.

Other reads and writes that encounter those locks need to inspect the transaction's primary key and help resolve its final status. This is why a slow participant often increases `ResolveLock` activity elsewhere in the cluster.

## Resolving Unfinished Transactions

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

## The Scheduler Pipeline

The scheduler turns a transaction request into the reads and writes above. At a high level, it:

1. receives the command;
2. obtains a snapshot and reads the required MVCC data;
3. acquires latches and checks locks and committed versions;
4. prepares the column-family modifications;
5. submits them through `async_write`;
6. completes the command after Raftstore finishes the write.

The scheduler owns this multi-step transaction task. The storage read pool performs read-only work against snapshots, such as point reads and scans. The scheduler uses those results to make transaction decisions; the read pool does not own latches or the transaction protocol.

## Reading Scheduler Metrics

The scheduler exposes stages that help locate delay:

```text
new -> snapshot -> process -> write -> write_finish
```

- `new` covers command admission into the scheduler.
- `snapshot` covers obtaining the read snapshot.
- `process` covers MVCC and lock reads, conflict checks, and mutation preparation.
- `write` begins after processing and leads into `async_write`.
- `write_finish` completes when the asynchronous write finishes.

`storage command total` starts when the gRPC layer hands the request to storage, before latch waiting. `scheduler command duration` measures the task from creation to completion.

`scheduler pending commands` counts commands from admission until `write_finish`, including commands waiting for Raftstore's asynchronous write. `scheduler running commands` counts commands actively being executed and does not include commands waiting for latches.

High scheduler delay can come from slow MVCC scans, latch contention, or CPU saturation. A slow first poll around snapshot work can be consistent with unified read-pool queueing, but it should be confirmed with read-pool queue and CPU metrics rather than attributed to flow control from this timer alone.

This chapter covers the classic 2PC path. The concurrency manager, 1PC, and async commit add further rules around lock timestamps and commit timing; they belong to later chapters.

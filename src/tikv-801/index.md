# TiKV 801: Region Merge

Splitting prevents Regions from becoming too large. **Merging** does the reverse: when adjacent Regions become small, PD can combine them so that TiKV does not keep many tiny Raft groups.

PD uses a configured merge-size threshold to decide when a Region is a candidate.

## Source and Target

A merge has two Regions:

- the **source** Region disappears;
- the **target** Region expands to own the source's key range and data.

For the merge to stay lightweight, every store hosting a source peer must also host the corresponding target peer. Then each store can update its local Region metadata without moving the source data through a new replica.

```text
Store 1: Source S1    Target T1
Store 2: Source S2    Target T2
Store 3: Source S3    Target T3
```

## Preparing the Source

The source leader first finds the smallest **matched index** among its peers. A matched index is the log position that the leader knows a follower has replicated.

It then proposes `PrepareMerge`, which contains:

```text
target Region metadata
minimum matched index
PrepareMerge log index
```

Using the minimum matched index matters. A committed index alone is not the right boundary for the catch-up log interval; the merge needs a position that every relevant peer is known to have matched. [TiKV PR 18204](https://github.com/tikv/tikv/pull/18204) removed an override that used the minimum committed index instead.

When `PrepareMerge` commits and applies, the source Region enters `Merging`. It records the target Region, the minimum index, and the PrepareMerge commit index. It also stops accepting new writes.

```text
Normal source
    |
    | PrepareMerge applies
    v
Merging source: writes frozen
```

The source now waits for the merge to finish. A tick-driven event repeatedly tries to advance the merge.

## Committing the Merge

Source peers send a `CommitMerge` request to the target peer on the same store. Only the target leader can propose it into the target Region's Raft log.

`CommitMerge` carries the source Raft log entries from `min_index` through the `PrepareMerge` index. The target needs these entries to bring its local source peer up to date before it can safely consume the source.

```text
source peer
  |
  | CommitMerge + source log interval
  v
target leader
  |
  | propose and commit in target Raft group
  v
target applies merge and expands its range
```

When the target applies `CommitMerge`, it enters a catch-up phase for the carried source entries. This matters for a source peer that was behind when merging started.

The source peer must still exist during this process. Once its logs are destroyed, they cannot be replayed to finish `ApplyMerge`; deleting the source too early is a correctness failure.

## Two Catch-Up Paths

The source peer may already have applied `PrepareMerge`, or it may still be behind.

If the source executed `on_ready_prepare_merge`, it has already caught up through the prepare point. No additional source-log catch-up is needed for that peer.

Other source peers may never have reached `on_ready_prepare_merge`. They receive the carried log interval through `on_catch_up_logs_for_merge`, then an apply task reports `LogsUpToDate` before the merge can finish locally.

The observed order can therefore differ:

```text
source::on_ready_prepare_merge
    -> target::exec_commit_merge
    -> source::on_catch_up_logs_for_merge
    -> ApplyTask::LogsUpToDate
```

or the target can execute `CommitMerge` before a lagging source reaches its prepare-ready path. The catch-up state makes both orders safe.

## Rollback Before the Point of No Return

Before the target commits `CommitMerge`, the source can still propose `RollbackMerge`. This returns the source to normal operation and unfreezes writes.

Once the target commits `CommitMerge`, the merge has a final outcome. The protocol must then finish the target update and source destruction rather than roll back halfway through.

A source follower that needs a snapshot is evidence that it is behind. The original merge preparation may no longer describe a safe local situation, so the merge must be retried or rolled back instead of assuming the old preparation is still enough.

## Snapshot and Source-Destroy Race

The target Region may move forward and receive a newer snapshot while a source peer is still waiting to be consumed.

In that case, applying the target snapshot and destroying the source must be atomic. If TiKV destroys the source first, it loses the source logs that could still be needed for `ApplyMerge`. If it applies the snapshot first without coordinating destruction, both topologies can remain visible at once.

The atomic snapshot-region mechanism ties these two transitions together. The more detailed peer-state and snapshot rules are covered in [TiKV 901: Raft Peer Lifecycle](../tikv-901/index.md).

# TiKV 603: Region Split

A Region is a continuous interval of keys. As the interval accumulates data and traffic, one Region can become too large to serve, replicate, or move efficiently. A **split** divides it into smaller Regions that TiKV can manage independently.

## Why a Region Splits

Suppose Region 10 owns the keys from `a` through `z`.

```text
before

Region 10: [a, z)
```

If it splits at `m`, the result is two smaller key intervals:

```text
after

Region 10: [a, m)
Region 20: [m, z)
```

The original Region keeps one interval and a new Region receives the other. From that point on, they have separate Raft groups, leaders, and schedules.

TiKV periodically checks whether a Region has grown large enough to split. It uses an approximate size first, avoiding an expensive scan when a split is unlikely. PD can also request a split directly.

The split key must divide the original Region's key range. For an automatic split, TiKV chooses a useful boundary near the desired data size. The exact choice is less important than the result: every key belongs to exactly one of the two new intervals.

## A Split Is a Raft Change

A split changes the cluster's topology, so the leader cannot make it only in local memory. It proposes a Raft administrative entry that describes the resulting Regions.

```text
leader proposes split
        |
        v
replicas replicate the split entry
        |
        v
the entry commits
        |
        v
every peer applies the same new Region boundaries
```

This gives every existing replica the same answer to two questions: which keys remain in the original Region, and which keys belong to the new Region.

## Applying the Split in TiKV

All peers of the original Region already have the same key-value data. Splitting does not copy that data to another store. On each store, the existing RocksDB data already covers both resulting key ranges.

TiKV applies the split by writing durable metadata for both Regions in one KV Engine write batch. The metadata records their ranges, peer lists, and apply state. After a crash, TiKV sees either the old single-Region metadata or the complete two-Region metadata, never a half-applied split.

```text
before apply
  Region 10 owns [a, z)

after apply
  Region 10 owns [a, m)
  Region 20 owns [m, z)
```

After the durable update, Raftstore creates the new in-memory peer for Region 20. The new Region starts with its own Raft state and evolves independently from Region 10. Future writes to the two key ranges enter different Raft logs.

## Routing After a Split

The old Region route is no longer enough after the split. TiKV reports the resulting Region metadata to PD, and PD provides the new routing information to TiDB.

A request using stale Region metadata may reach a peer with the wrong range or epoch. TiKV rejects it, and TiDB refreshes its route before retrying the request against the correct Region.

Splitting itself does not redistribute data across stores. It only creates smaller units. PD can later use leader transfers and conf changes to balance those new Regions across the cluster.

The normal split path is short: one Raft entry creates two durable key ranges from one. Snapshots, peer creation, and destruction can race with that change; [TiKV 901](../tikv-901/index.md) covers those lifecycle details later.

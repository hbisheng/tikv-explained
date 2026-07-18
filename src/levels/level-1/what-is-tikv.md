# What Is TiKV?

TiKV is a distributed key-value storage system.

At the simplest level, TiKV stores keys and values:

```text
put("user:42:name", "Alice")
get("user:42:name") -> "Alice"
```

The interesting part is that TiKV does this as a cluster. Data is split into ranges. Each range is replicated to multiple TiKV nodes. If one node fails, the data should still be available from other nodes.

For a first mental model, think of TiKV as three ideas combined:

```text
KV storage + replication + distribution
```

That is still incomplete, but it is a useful starting point.

Later levels add the missing pieces: Regions, Raft, PD scheduling, MVCC, transactions, RocksDB, Raftstore, and recovery behavior.

## What Should Remain

TiKV is not just "a database written in Rust." It is a distributed storage system that keeps key-value data replicated and movable across a cluster.


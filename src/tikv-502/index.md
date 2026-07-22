# TiKV 502: Linearizable Reads

Raftstore writes data through Raft before applying it to RocksDB. A read is more subtle: a local RocksDB snapshot is not automatically safe to return.

The read must include every `async_write` that completed before the read began. This is the meaning of a **linearizable read**.

## What a Snapshot Must Include

When an `async_write` completes, its Raft entry has been committed and applied to the Region's RocksDB state. The Region records this progress in `apply_index`, the index of the latest Raft entry applied to RocksDB.

`async_snapshot` must return a RocksDB snapshot taken after all earlier completed writes have reached that applied state.

Raftstore represents this boundary with a `read_index`: a Raft log index that the snapshot must include. A snapshot is safe only after `apply_index >= read_index`.

```text
async_write completes
        |
        v
apply_index advances
        |
        v
async_snapshot begins
        |
        v
snapshot must include that applied write
```

This is why a snapshot cannot be created from an arbitrary replica at an arbitrary time. A follower may still be applying old entries, and a former leader may no longer be the leader.

## The Simple but Slow Approach

The most direct way to create a safe read point is to propose an empty Raft entry and wait until it is applied.

Raft orders the empty entry after all preceding writes. Once it reaches RocksDB, every earlier committed entry must also have reached RocksDB. Raftstore can then take a snapshot.

```text
propose empty entry
        |
        v
replicate and commit it
        |
        v
apply it to RocksDB
        |
        v
take snapshot
```

This works, but it is too expensive for normal reads. Every read would add a log entry, persist it, replicate it, and apply it, even though the read does not change data.

## Why the Leader Must Be Current

Only the current leader can establish a linearizable read point for a Region. A node that used to be leader may be disconnected from the majority while another leader has been elected elsewhere. Reading from that old leader could miss a write that has already completed on the new leader.

Raft divides time into **terms**. Each election chooses a leader for one term, and a newer term always has a larger number. But being elected in a term is not enough: the leader must also know that it still has contact with a majority of replicas.

## Leader Lease

A leader sends periodic heartbeats to followers. A follower starts an election only after it has not heard from a leader for an **election timeout**.

Raftstore uses a **leader lease** that is slightly shorter than that election timeout. When the leader receives recent heartbeat acknowledgements from a quorum, it renews the lease. While that lease is valid, the leader knows that the quorum which acknowledged it has not timed out and started another election.

With a valid lease, the leader can serve a read without writing a new Raft entry. It uses its current committed position as the read point, waits until RocksDB has applied through that point, then returns a snapshot.

```text
valid leader lease
        |
        v
wait until apply_index reaches the read point
        |
        v
take RocksDB snapshot
```

The lease is a fast path. It avoids an extra network round trip for reads while the leader is actively communicating with its followers.

## ReadIndex When the Lease Is Not Valid

A lease may not be valid when a leader has just been elected, after a long pause, or when it has not recently heard from a quorum. In those cases, Raftstore uses **ReadIndex**.

ReadIndex asks the leader to confirm its leadership explicitly:

1. The leader sends heartbeats to the followers.
2. A quorum of followers acknowledges the heartbeats.
3. The leader now knows it is still the leader for the current term and uses its current committed position as `read_index`.
4. The leader waits until `apply_index` has reached `read_index`.
5. Raftstore takes a RocksDB snapshot.

```text
leader
  |
  | heartbeat with ReadIndex request
  v
followers
  |
  | acknowledgements from a quorum
  v
leader confirms leadership
  |
  | wait until apply_index >= read_index
  v
take RocksDB snapshot
```

ReadIndex does not add a new Raft log entry or persist a new log record. It only needs a quorum heartbeat round trip and a wait for local application to catch up.

`async_snapshot` therefore has two ways to establish a linearizable read point: use a valid leader lease, or confirm leadership through ReadIndex. In both cases, it returns a RocksDB snapshot only after the required Raft entries have been applied.

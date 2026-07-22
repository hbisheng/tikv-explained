# TiKV 501: Raftstore Write Flow

Raft and RocksDB solve different parts of the storage problem.

Raft makes replicas agree on the order of changes. RocksDB stores key-value data durably on one machine. Neither one alone gives TiKV a replicated, durable key-value store.

**Raftstore** connects them. It accepts changes for a Region, replicates them through Raft, and applies committed changes to RocksDB. This is the part of TiKV that keeps data available after a machine failure and durable across restarts.

## Two Engines

Raftstore uses two local storage engines:

- The **Raft engine** stores Raft logs and Raft state.
- The **KV engine** is RocksDB. It stores the Region's key-value state.

Every data change follows this order:

```text
client write
    |
    v
Raft log persisted on a quorum
    |
    v
entry committed
    |
    v
change applied to RocksDB
```

This is a distributed form of **write-ahead logging**, or WAL: first make the change durable in a log, then apply it to the key-value state.

The Raft engine is a custom engine optimized for Raft logs. We will cover its implementation later. For now, treat it as another local database whose job is to store the Raft log.

## Two Raftstore Interfaces

Raftstore exposes two important asynchronous interfaces.

### `async_write`

`async_write` accepts a list of key-value modifications, such as puts and deletes.

```text
put("cart:42", "checked-out")
delete("cart:42:temporary-note")
```

When its callback reports success, the modifications have been committed by a Raft quorum and applied to the leader's KV engine. This advances the Region's `apply_index`, the log position most recently applied to RocksDB. In a usual three-replica Region, the committed entry is persisted on two TiKV stores and can tolerate one store failure.

### `async_snapshot`

`async_snapshot` returns a Region snapshot that can read from the KV engine. It is a **linearizable** point-in-time view: it includes every write that completed before the snapshot request.

This matters because a local RocksDB instance alone may be behind the Region leader. Raftstore first establishes a safe point in the Region's Raft history, then returns the corresponding RocksDB snapshot. The snapshot can be used for point reads and scans.

### Why `async`?

Raft replication, disk persistence, and network messages take time. A caller submits a request with a callback instead of waiting inside the call.

```text
submit request + callback
          |
          v
Raftstore processes the request
          |
          v
invoke callback with the response
```

## One Region Write

Consider a write to one Region.

1. The Region leader accepts the write and **proposes** a new Raft log entry containing the modifications.
2. Raftstore gives the proposal to the Region's `raft-rs` peer. The peer's `Ready` contains the new log entry to persist and `AppendEntries` messages to send to followers.
3. Raftstore persists the entry in the leader's Raft engine and sends the messages to followers in parallel.
4. Each follower receives `AppendEntries`, persists the entry in its own Raft engine, and replies with `AppendResponse`.
5. Once a majority has persisted the entry, Raft marks it committed.
6. The committed entry appears in `Ready`. Raftstore sends it to the apply system, which writes the modifications to RocksDB.

Remote Raft messages enter `raft-rs` through `step`, as described in [TiKV 402: The Raft Event Loop](../tikv-402/index.md). A local client write enters through Raft's proposal API. Both can produce a `Ready` with storage and network work for Raftstore to perform.

An `async_write` completes after its entry has committed and been applied to the leader's KV engine. At that point, a later leader must contain the entry as long as a Raft majority survives.

## Many Regions, One Store

One TiKV store usually hosts many Region peers. Each peer has its own Raft state machine and a **mailbox**, a queue of events waiting for that peer.

Processing every event with its own disk write and network send would be expensive. Small I/O operations have a fixed cost, so Raftstore gathers work from many Regions and performs it together.

Raftstore works in rounds:

```text
one Raftstore round

take up to 256 Region peer FSMs
    |
    +-- for each peer, process up to 4096 mailbox messages
    |       |
    |       +-- drive raft-rs
    |       +-- collect Ready work
    |
    +-- batch Raft-log persistence
    +-- batch Raft-message sends
    +-- send committed entries to the apply system
```

An FSM, or finite-state machine, is the component that drives one Region peer. We met the same idea in [TiKV 402](../tikv-402/index.md): it feeds events into `raft-rs`, takes work from `Ready`, and reports completion with `advance`.

The limits above are the default batch sizes: at most 256 peer FSMs per round and at most 4096 messages from one mailbox. The important idea is not the exact numbers. Raftstore can turn many small per-Region tasks into fewer, larger disk and network operations.

## Applying Committed Entries

Committing a Raft entry means that the replicas have agreed on it. The entry still needs to change the KV engine.

Raftstore forwards committed entries to a separate apply batch system. Each Region has an `ApplyFsm` that receives entries for that Region. The apply system gathers entries from many Regions, then writes their key-value changes to RocksDB in batches.

Most applied entries do not need a RocksDB WAL sync. If a TiKV store crashes before those KV changes reach durable RocksDB storage, the committed Raft log still exists and can be applied again after restart.

Some administrative commands do require a WAL sync because their local state must be made durable at that point. We will cover those commands later.

Raftstore therefore has one core job: persist an ordered change through Raft, wait until it is committed by a quorum, then apply it to the local KV state. Batching lets TiKV perform this job efficiently for many Regions at once.

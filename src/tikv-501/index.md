# TiKV 501: Raftstore Write Flow

In [TiKV 402](../tikv-402/index.md), we followed the event loop for a single Region peer. We saw how the peer FSM processes events, passes incoming Raft messages to `raft-rs`, and handles the resulting `Ready`.

That gave us the shape of the loop, but left much of the work behind `Ready` unexplained. A `Ready` may contain outgoing messages, Raft log entries and state to persist, and committed entries to apply.

This chapter fills in those missing parts. We will first see where the persistent state is stored, then follow one write through the complete loop, and finally extend the same process from one Region to many.

## Raft Engine and KV Engine

The storage work is divided between two local engines:

- The **Raft Engine** stores Raft log entries and persistent Raft state.
- The **KV Engine** stores the Region's key-value data. In TiKV, the KV Engine is RocksDB.

The two engines represent the same Region in different forms:

```text
Raft Engine: replicated history of commands
KV Engine:   data produced by applying those commands
```

A command first becomes part of the replicated Raft history. Once that command is committed, its effect is applied to the KV Engine.

Following one write shows how these two forms remain connected.

## A Write Through Raftstore

A write reaches the peer for its target Region as a local command. For example, the command may contain several key-value modifications:

```text
put("cart:42", "checked-out")
delete("cart:42:temporary-note")
```

Submitting a command to Raft is called proposing it. A proposal asks `raft-rs` to place the command in the replicated Raft log.

Like an incoming Raft message, the local command is processed by the peer FSM. The main difference is how the event enters `raft-rs`:

```text
incoming Raft message -> step
local command         -> propose
```

After either operation, the peer returns to the same loop and checks whether `raft-rs` has produced a `Ready`.

Only the Region leader can propose the command. If the local peer is not the leader, it rejects the request so that the caller can send it to the correct store.

On the leader, the proposal creates a new Raft log entry. The next `Ready` tells Raftstore to persist that entry in the local Raft Engine and send `AppendEntries` messages to the followers.

Each follower processes the incoming message through the message path described in [TiKV 402](../tikv-402/index.md). Its own `Ready` tells Raftstore to persist the entry in that follower's Raft Engine before responding to the leader.

Once the leader learns that a majority has persisted the entry, `raft-rs` can mark it committed. The committed entry then appears in a later `Ready`. Raftstore applies it by interpreting the command and writing its modifications to the KV Engine.

The complete write flow is therefore:

```text
local command
    |
    v
propose to raft-rs
    |
    v
Raft log entry
    |
    v
persist and replicate
    |
    v
commit
    |
    v
apply to the KV Engine
```

Followers learn the new commit position through later Raft messages and apply the same command to their own KV Engines.

This describes the flow for one Region. A real TiKV store must perform the same work for many Regions at once.

## Processing Many Regions in Batches

Each Region peer has its own **mailbox**, a queue of pending events for its peer FSM. It also has its own Raft state machine, commit index, and apply index.

Raftstore could process every peer independently and issue a separate engine write for each `Ready`. That hypothetical approach would produce many small I/O operations:

```text
Region 1 -> small Raft Engine write
Region 2 -> small Raft Engine write
Region 3 -> small Raft Engine write
```

But this is not how TiKV operates. Small writes have a fixed cost, so Raftstore combines work from multiple Regions into fewer, larger writes:

```text
Region 1 Ready ---\
Region 2 Ready ----> one larger Raft Engine write
Region 3 Ready ---/
```

Raftstore does this through two major batch systems:

- the Raft batch system;
- the apply batch system.

### The Raft Batch System

The Raft batch system drives the peer FSMs for many Regions.

For each peer, it takes events from the mailbox, calls into `raft-rs`, and collects the resulting `Ready` work. It then coordinates that work across multiple peers by:

- batching Raft Engine writes;
- sending outgoing Raft messages;
- forwarding committed entries to the apply batch system;
- advancing each peer after the required work has completed.

The single-Region event loop from [TiKV 402](../tikv-402/index.md) still exists. The Raft batch system simply processes many instances of that loop together.

### The Apply Batch System

The apply batch system receives the committed entries produced by the Raft batch system.

Each Region has its own `ApplyFsm`, which applies that Region's entries in Raft log order. Applying an entry may produce operations such as:

```text
put key
delete key
update Region metadata
advance apply index
```

The apply system groups changes from multiple `ApplyFsm`s into larger KV Engine write batches.

The two systems therefore divide the work along the same boundary as the two engines:

```text
Raft batch system
  drive peer FSMs and raft-rs
  persist Raft logs and state
  send Raft messages
          |
          | committed entries
          v
Apply batch system
  apply commands
  update apply indexes
  write to the KV Engine
```

Because the Raft and apply systems progress separately, a committed entry may not yet be reflected in the local KV Engine. TiKV records that difference so it can recover correctly after a restart.

## Restart Recovery

The apply index records the highest Raft log index whose effects are already present in a Region's local key-value data.

For example, a Region may temporarily have:

```text
commit index: 105
apply index:  102
```

Entries 103 through 105 are already committed, but this store has not yet applied them to its KV Engine.

Whenever the apply system processes an entry, it writes the command's data changes and the new apply index in the same KV Engine write batch. Applying entry 103 therefore produces a batch containing both:

```text
changes produced by entry 103
apply index = 103
```

The data and the apply index advance atomically. If TiKV crashes during this operation, the recovered KV Engine reflects either both changes or neither:

```text
entry 103 not applied
apply index = 102
```

or:

```text
entry 103 applied
apply index = 103
```

When TiKV restarts, the Raft Engine provides the persisted Raft state and log entries, while the KV Engine provides the materialized data and apply index.

If the recovered positions are:

```text
commit index: 105
apply index:  102
```

TiKV knows that entries 103 through 105 still need to be applied. During startup, if the commit index is ahead of the apply index, TiKV forces the peer to handle a `Ready`. Its committed entries are scheduled to the apply system, which applies them and advances the apply index until it reaches 105.

## The Interface Used by the Transaction Layer

The transaction layer does not interact directly with peer FSMs, `raft-rs`, or either storage engine. It accesses Raftstore through two main asynchronous operations:

- `async_write`
- `async_snapshot`

Both operations are asynchronous because Raftstore runs on its own event loops. The caller submits a request with a callback, allowing Raftstore to complete the required Raft, network, and storage work before returning the result.

### `async_write`

`async_write` submits a batch of key-value modifications.

Raftstore routes the command to the target Region peer, proposes it through Raft, and invokes the callback after the command has been committed and applied to the leader's KV Engine.

```text
async_write
    |
    v
peer mailbox
    |
    v
propose
    |
    v
persist and replicate
    |
    v
commit
    |
    v
apply
    |
    v
callback
```

The transaction layer therefore sees one asynchronous write operation, while Raftstore handles the full replicated write flow underneath it.

### `async_snapshot`

`async_snapshot` asks Raftstore for a readable snapshot of a Region.

Raftstore first establishes the required Raft read position and waits until the local KV Engine reflects that position. It then returns a snapshot that the transaction layer can use for point reads and scans.

We will examine this path in more detail in [TiKV 502: Linearizable Reads](../tikv-502/index.md).

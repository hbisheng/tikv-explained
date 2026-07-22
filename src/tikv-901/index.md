# TiKV 901: Raft Peer Lifecycle

A Region replica is called a **peer**. Its in-memory `Peer` object can disappear during a restart, but the Region's durable state must still say what exists, what has been applied, and what work was in progress.

Raft peer lifecycle is therefore a durable state machine. Add-peer, delete-peer, snapshot, split, and merge operations all become transitions in on-disk state. On restart, TiKV rebuilds its in-memory peers from those states.

## Two Engines, Different State

TiKV stores peer state in both the Raft engine and the KV engine.

The Raft engine stores `RaftLocalState`:

```text
term
vote
commit index
last log index
```

This is the durable state needed by the Raft protocol itself.

The KV engine stores two important records:

```text
RaftApplyState
  applied Raft index and apply progress

RegionLocalState
  key range, epoch, peer list, and PeerState
```

They are separate because their scope and update frequency differ. `RaftApplyState` changes with every applied KV write. `RegionLocalState` describes the Region's topology, so it changes much less often.

They also have different deletion rules. When a peer is removed, TiKV can delete its apply state but keeps a tombstone `RegionLocalState` as durable evidence that the peer used to exist.

## Restart Rebuilds the In-Memory Peers

At startup, TiKV scans `RegionLocalState` records. They determine which Region peers should be created in the Raftstore batch system and whether any previous lifecycle work must continue.

For example:

- a `Tombstone` state may still require leftover data to be deleted;
- an `Applying` state means a snapshot application must resume or be retried;
- a normal state becomes an in-memory Raft peer and its PeerFsm.

The router, range index, read delegates, and other Raftstore structures are only in-memory projections of this durable topology. TiKV can recreate them after restart.

## Applying Raft Entries Atomically

A client write enters as a Raft log entry. When the entry is applied, TiKV must update the user KV data and `RaftApplyState.applied_index` together.

```text
Raft entry
    |
    v
KV WriteBatch
    |- user-key modifications
    |- updated applied_index
    |
    v
one atomic KV-engine write
```

If the data changed but the applied index did not, TiKV could replay an entry incorrectly after restart. If the applied index advanced without the data, TiKV could skip a required write. One KV-engine write batch prevents both outcomes.

## Peer States

`RegionLocalState` contains a durable peer state:

```rust
enum PeerState {
    Normal = 0,
    Applying = 1,
    Tombstone = 2,
    Merging = 3,
}
```

`Normal` is the ordinary serving state.

`Applying` means the decisive metadata for a snapshot has been written, but the snapshot's range cleanup and SST ingestion have not finished. A snapshot cannot be applied in one write batch because it may delete an old key range and ingest several SST files. `Applying` is the durable marker that lets TiKV resume this multi-step operation after a restart.

`Tombstone` records that a peer has been destroyed. TiKV keeps its peer ID and epoch so that an old Raft message cannot recreate a peer that has already been removed.

`Merging` records that a Region is preparing to merge into another Region. The merge protocol needs more state and is explained later in this chapter.

## Adding a Peer

Suppose Region 10 initially has three peers:

```text
Store 1: Peer 101 (leader)
Store 2: Peer 102
Store 3: Peer 103
```

PD decides to add Peer 104 on Store 4. It sends a configuration change, or `ConfChange`, to the Region leader. Once the configuration change commits, every existing peer applies it and updates `RegionLocalState.region.peers`.

Store 4 has no local state for Peer 104 yet. It first receives an initial Raft message from the leader. This is usually a heartbeat, although vote or pre-vote messages can also become initial messages when leadership changes.

TiKV marks these messages with `is_initial_msg`. The outer `RaftMessage` carries the start key, end key, Region epoch, and from/to peer metadata needed for the receiving store to enter the create-peer path.

The new store creates an **uninitialized peer** in memory and waits for a snapshot. The initial message has enough metadata to identify the Region, but it does not carry the Region's data. The peer cannot serve until snapshot application finishes.

## Snapshot Application Crosses Two Engines

Snapshot application updates both engines, but TiKV cannot make one atomic write across the Raft engine and the KV engine.

TiKV writes the KV-engine `RegionLocalState` first and records `snapshot_raft_state_key` there. This key marks Raft-engine work that may still be missing. During recovery, TiKV can inspect the marker and finish the Raft-engine update if needed.

When snapshot application completes, TiKV sets the Region state to `Normal` and removes `snapshot_raft_state_key`.

```text
KV engine:   Applying metadata + snapshot_raft_state_key
                    |
                    v
Raft engine: required Raft state
                    |
                    v
KV engine:   Normal state, remove marker
```

The marker closes the crash window between the two engines.

## Deleting a Peer

When a peer applies a configuration change that removes itself, it begins `destroy_peer`.

The durable transition writes a `Tombstone` `RegionLocalState` and removes the peer's apply-state keys. The tombstone remains so that stale messages with an older peer ID or epoch cannot bring the peer back.

Deletion can race with a new peer or snapshot:

1. If snapshot metadata has not been persisted, TiKV can destroy the peer directly.
2. If the peer is already `Applying`, TiKV waits until snapshot application reaches a safe point, then performs destruction.

The second rule prevents a snapshot from finishing after its peer has already been destroyed.

## Splitting a Region

A split changes the durable topology in one apply step. Suppose R10 splits and creates R20.

When the split entry applies, TiKV writes the updated state for R10 and initial state for R20 into the KV engine together. The child Raft state can be constructed from the split's initial Raft index and term if it has not been written yet.

The important crash cases are:

| Crash point | Durable state | Restart result |
|---|---|---|
| Split entry not persisted | Old R10 | Raft replicates or proposes the split again |
| Entry committed but not applied | Old R10; applied index before split | Replay the split entry |
| KV WriteBatch is committing | RocksDB gives old-or-new atomicity | Old R10, or complete R10 plus R20 |
| KV WriteBatch finished before in-memory callback | R10 plus R20 exist | Rebuild both peers from `RegionLocalState` |
| Child Raft state not built | Child KV metadata exists | Construct initial child Raft state from split index and term |

This is why the in-memory router and range index are never the source of truth. The KV-engine topology is sufficient to rebuild them.

## The Split Initial-Peer Race

Adding a peer and splitting can create the same child peer through two paths. Imagine that a newly added Peer 3 receives a pre-split snapshot, and later the split creates child Peer 1003.

Path one creates Peer 1003 when Peer 3 applies the split. Path two creates an uninitialized Peer 1003 when a post-split Raft message arrives before that snapshot is applied. Both peers may wait for snapshots at the same time.

`pending_snapshot_regions` resolves the first race. The first snapshot to claim the key range reserves it. An overlapping snapshot is rejected. If the split-created peer has already finished, a later replication-created snapshot also sees that the stored Region metadata no longer matches its empty expected metadata and is rejected.

There is a second race with deletion. An uninitialized child may be waiting while the split creates that child through the other path.

- If deletion wins first, it persists a tombstone. The split must respect that tombstone and skip the child.
- If the split wins first, deletion does not remove the data immediately. It waits for peer garbage collection to destroy the created child safely.

`pending_create_peers` coordinates these cases. It also fixes the expected peer ID so that a split cannot replace a newer generation of the peer. Together with the `StoreMeta` lock, it serializes split creation and replication-message creation into one of two valid orders:

```text
split publishes the initialized peer; replication create gives up

or

replication create publishes an uninitialized peer; split replaces it
```

The invalid order is an initialized peer being overwritten later by an empty replication-created peer.

## Peer Garbage Collection

A peer can discover that it should delete itself without a direct PD delete command.

- It receives a message showing that it is no longer in the Region's peer list.
- It has not heard from a leader for a long time and asks PD whether it is still valid.

Both paths eventually run the same durable destroy flow and leave a tombstone.

## Merge as a Durable State Machine

A merge combines a source Region into a target Region. Before merge starts, each store that hosts a source peer must also host the corresponding target peer.

For example, source peers S1/S2/S3 and target peers T1/T2/T3 may live on Stores 1/2/3 respectively.

1. PD asks the source leader to propose `PrepareMerge`.
2. When it applies, the source `RegionLocalState` becomes `Merging` and records the target Region, `min_index`, and the PrepareMerge `commit_index`.
3. The source Region stops accepting new writes. It is now frozen.
4. Each source peer asks the target peer on the same store to propose `CommitMerge`. Only the target leader can successfully propose it.

A source peer that applied `PrepareMerge` has the complete Raft log interval from `min_index` through `commit_index`. Before the target commits `CommitMerge`, the source can still propose `RollbackMerge`. After `CommitMerge` commits, the merge has a final outcome.

The target coordinates the source peer's log catch-up and apply shutdown, then applies `CommitMerge`. This atomically updates the source and target Region states in the KV engine.

## Merge Garbage Collection and Snapshots

A source peer can be left behind while other stores complete the merge. It records the target Region and target epoch from the merge state.

- If the local target peer exists with the expected epoch, the source waits to be consumed by `CommitMerge`.
- If the local target epoch has advanced, the target has already moved past this merge point. The source deletes itself.

A snapshot can race with this decision. With the expected target peer generation, a post-merge snapshot with a newer epoch can prove that the source should be removed. A pre-merge snapshot cannot.

In that same-generation case, applying the target snapshot and deleting the source metadata must be atomic. `atomic_snap_regions` provides that protection.

If the target is a newer peer generation with a larger peer ID, TiKV can remove the source first and then apply the target snapshot. There is no longer an outstanding merge expectation tied to the old target peer.

## Why Consecutive Merges Do Not Lose History

A Region can repeatedly be a merge target, but becoming a merge source means it will disappear. Before it prepares to disappear, `PrepareMerge` checks follower-reported matched and committed indexes.

If the relevant log interval might still contain an older `CommitMerge` or another administrative entry that changes Region history, TiKV rejects the new merge. This prevents a Region from disappearing before all peers have replicated the history required to understand its topology.

Each peer applies Raft entries in order. Even if a peer has not applied an earlier merge yet, it must apply that historical `CommitMerge` before the later `PrepareMerge`. TiKV only needs to persist one merge-state hop at a time because the protocol and PD's peer-placement constraints preserve that ordering.

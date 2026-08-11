# TiKV 602: Conf Change

A Region's peer set is not fixed. PD may add a peer to spread data across stores, remove a peer from an unhealthy store, or change a learner into a voting peer.

This is a **configuration change**, usually called a **conf change**. It changes the Raft group itself: who receives logs, who can vote, and what counts as a majority.

## Raft Side

A conf change is a special Raft log entry. The leader proposes it, replicates it, and commits it like other entries.

```text
propose conf change
        |
        v
replicate to the Raft group
        |
        v
commit and apply the entry
        |
        v
update the peer configuration
```

Until the entry is committed and applied, the old configuration remains in effect. This makes every peer observe the same membership change at the same point in the Raft log.

TiKV does not propose another conf change while one is pending. Membership changes need a clear order because they affect the quorum that protects the Region.

## TiKV Side

PD decides where to add or remove a peer and sends a `ChangePeer` request to the Region leader.

```text
before: Peer 1, Peer 2, Peer 3

add Peer 4

after:  Peer 1, Peer 2, Peer 3, Peer 4
```

For an added peer, the target store initially has no Region data. It receives an initial Raft message, creates an in-memory peer, and catches up with the Region's history. That catch-up may use Raft log entries or a snapshot. [TiKV 707](../tikv-707/index.md) explains the snapshot path.

When the conf change applies, every peer updates its durable Region metadata with the new peer set. If the change removes the local peer, TiKV destroys that peer and leaves a tombstone so that stale Raft messages cannot recreate it. [TiKV 901](../tikv-901/index.md) examines these durable lifecycle transitions in detail.

PD can combine these operations into a replica move: add a replacement peer, wait for it to catch up, transfer leadership if needed, then remove an old peer. Each step is separately ordered and replicated by Raft.

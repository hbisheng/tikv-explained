# TiKV 707: Snapshot

Raft normally keeps replicas in sync by sending log entries. A follower receives the entries it missed, appends them, and applies them in order.

That works only while the leader still has the needed log entries. Raft logs are compacted over time, so they cannot grow forever. A follower that falls too far behind needs a different way to catch up: a **Raft snapshot**.

A Raft snapshot is not the RocksDB snapshot used for reads in [TiKV 403](../tikv-403/index.md) and [TiKV 502](../tikv-502/index.md). A RocksDB snapshot is a local read view. A Raft snapshot transfers enough state to bring another peer back to a known point in the Region's history.

## When Logs Are Not Enough

Suppose the leader has compacted its log through index 80, but a follower is still at index 25.

```text
leader:   compacted ... 80 | 81 | 82 | 83
follower: applied through 25
```

The follower needs the history after 25, but the leader no longer has entries 26 through 80. Sending ordinary `AppendEntries` messages cannot repair the gap.

The leader instead sends a snapshot at a later point, such as index 80. A snapshot is also used when a new peer is added to a Region. The new peer needs the Region's existing data before it can follow new writes.

## One State at One Raft Position

A snapshot has two parts:

```text
Raft metadata
  the snapshot index, its term, and the peer configuration

Region data
  the key-value state after applying entries through that index
```

The index connects the two parts. A snapshot at index 80 means that its data already reflects every committed entry through index 80. After a follower installs it, the leader only needs to replicate entries after 80.

```text
before snapshot: follower applied through 25

install snapshot at 80

after snapshot:  follower applied through 80
                 normal replication resumes at 81
```

## Generating and Sending a Snapshot

When `raft-rs` decides that a follower needs a snapshot, it asks TiKV's Raft storage for one. Generating it can take time because TiKV must read the Region's key range and create data files for it.

TiKV generates the snapshot outside the Raft event loop. Until it is ready, Raft sees that the snapshot is temporarily unavailable and tries again later. This prevents a long scan from blocking ordinary Raft messages for the Region.

The generated data must match the snapshot index. TiKV schedules snapshot generation after the relevant applied work, then reads the Region from a consistent RocksDB view. The resulting data files therefore describe the Region at the Raft position recorded in the snapshot metadata.

The snapshot is usually much larger than an ordinary Raft message. TiKV keeps the two paths separate:

```text
Raft snapshot message
  small metadata: Region, index, term, peer configuration

snapshot data
  Region data files sent through a dedicated gRPC stream
```

Sending the data through the normal Raft message path could delay heartbeats and log replication. TiKV uses dedicated snapshot workers and the gRPC stream to transfer the large files without holding up those smaller messages.

## Receiving and Applying a Snapshot

The receiving TiKV store first receives and stores the snapshot data files. It then delivers the snapshot message to the Region peer.

Raft restores the peer's log position and configuration from the snapshot metadata. TiKV then installs the Region data into the local KV Engine.

```text
receive snapshot files
        |
        v
restore Raft position and peer configuration
        |
        v
replace the Region's local key-value state
        |
        v
resume normal log replication
```

The peer cannot serve the Region until this process finishes. Once it does, the peer has the same Region data through the snapshot index and can continue with ordinary Raft entries.

Applying a snapshot touches durable Raft state, Region metadata, and a potentially large key range. The crash recovery markers and lifecycle races behind that process belong to [TiKV 901](../tikv-901/index.md). For now, the essential model is simple: a snapshot replaces missing Raft history with the complete state produced by that history.

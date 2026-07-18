# Peer Lifecycle

> Draft status: placeholder. This chapter will eventually explain durable peer states, snapshot apply, destroy flow, split/merge interactions, and recovery behavior.

The important mental model is that a Peer is not just an in-memory object. TiKV needs durable state on disk so that restart recovery can decide whether a Peer is normal, applying a snapshot, tombstoned, or involved in merge.

Rust-shaped pseudocode is useful for this chapter because the real implementation has many details, but the mechanism can be introduced first:

```rust,ignore,noplayground
enum PeerState {
    Normal,
    Applying,
    Tombstone,
    Merging,
}

fn recover_peer(region_state: RegionLocalState) {
    match region_state.peer_state {
        PeerState::Normal => recreate_peer(),
        PeerState::Applying => resume_snapshot_apply(),
        PeerState::Tombstone => clean_leftover_data(),
        PeerState::Merging => resume_or_gc_merge_state(),
    }
}
```

The full chapter should answer these questions:

- What state is stored in Raft Engine?
- What state is stored in KV Engine?
- Why is snapshot apply marked durably before all work is complete?
- Why does TiKV keep tombstone metadata instead of deleting everything immediately?
- How do split, merge, snapshot, and destroy avoid recreating an old Peer incorrectly?

## What Should Remain

Peer lifecycle is mostly about making topology changes durable and recoverable under crashes, delayed messages, and races.


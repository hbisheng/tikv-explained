# TiKV 701: Region Split

A Region is a contiguous key range. As it receives more data and traffic, one Region can become too large to move, replicate, or serve efficiently. A **split** divides one Region into smaller key ranges so that TiKV can distribute them independently.

## Deciding Whether to Split

TiKV checks split conditions every 10 seconds. It first uses the Region's approximate size to decide whether a more expensive size check is worthwhile.

The normal size checker does not split a Region with too little accumulated write data. This avoids repeatedly splitting a quiet Region based on stale size estimates.

Several conditions postpone automatic splitting:

- Snapshot generation delays a split, up to three checks or about 30 seconds.
- Import mode disables splitting.

PD can also request a split directly. A **half checker** is used only for this PD-triggered case; it finds a split key near the middle of the Region's data.

## One Split Entry Changes the Topology

A split is a Raft administrative command. When it is committed, every replica applies the same split entry. The ApplyFsm performs the durable KV-engine changes in `ApplyDelegate::exec_batch_split`.

Suppose Region A splits into Regions A and B:

```text
before
|------------- Region A -------------|

after
|------ Region A ------|------ Region B ------|
```

The apply path writes the updated Region state and apply state for every resulting Region into the KV engine. These records are the durable topology from which TiKV can rebuild peers after restart.

The split path used to initialize child Raft state here as well. That write was removed by [TiKV PR 18718](https://github.com/tikv/tikv/pull/18718); the child Raft state can be constructed later from the split information when needed.

After the apply step, `ApplyFsm` sends `ExecResult::SplitRegion`. The corresponding `PeerFsm` handles it in `on_ready_split_region` and creates the new in-memory Raft peers.

## Reserving New Peers Before Publishing Them

`pending_create_peers` is the in-memory coordination map for peers that are about to be created. Before applying a split, TiKV inserts all child Regions into this map.

This reservation matters because the same child can also be created by an incoming Raft message and then wait for a snapshot. Such a replication-created peer is uninitialized and has a `false` split flag. The split path can take over that reservation, replace the empty peer, and abort its pending snapshot. A genuinely uninitialized peer is expected to have no `RegionLocalState` in the KV engine yet.

If TiKV finds durable Region state for the proposed child already, that child is not a new empty peer. It removes the temporary reservation instead of overwriting the state.

For a parent Region A, this existing state has two safe forms:

- `Normal` means the existing Region cannot overlap A, because normal Regions never overlap.
- `Tombstone` means the old Region is already dead.

In either case, the data range associated with the proposed child is not valid data to adopt for this split. `new_split_regions` tracks these cases so that obsolete range data can be cleaned up rather than treated as the new child.

## Snapshot and Local-First Creation

An incoming Raft message can create an uninitialized peer before any data exists locally. Snapshot application later makes that peer durable.

`pending_create_peers` is removed in `on_ready_persist_snapshot`, when the snapshot's persistent state is ready.

The `local_first` flag matters because it distinguishes the first creation of a Region's durable state from a later snapshot for an already existing peer. Both cases use the same `RegionLocalState` key. The first case creates that key; the later case must reuse and update it instead of treating the Region as new again.

## Replicate, Split, and Destroy

Three operations can race around one child peer:

1. **Replicate** creates an uninitialized peer from an initial Raft message.
2. **Split** tries to create the same child through the parent Region's split entry.
3. **Destroy** writes a tombstone when the peer should be removed.

`pending_create_peers` decides which operation owns creation.

### Replicate -> Destroy -> Split

If destroy wins first, it keeps the pending-create entry until destruction is complete, then leaves durable tombstone state. The split path cannot insert its own reservation while destroy owns it. When split later sees the KV-engine state, it does not create the child. Destruction wins.

### Replicate -> Split -> Destroy

If split inserts its reservation first with `split = true`, it owns child creation. A concurrent destroy skips the uninitialized peer instead of deleting it. Split wins.

The outcome depends on whether split can claim `pending_create_peers` before destroy reaches its durable transition. This is why the reservation is not merely an optimization; it is the race's ownership rule.

## A Newer Target Snapshot Can Remove a Merge Source

A source Region preparing to merge can receive a message for a newer target Region. If that target is newer than the version recorded by the merge, TiKV destroys the source data and adopts the target snapshot instead.

This is another example of the same rule: durable Region state and snapshot ownership decide which topology is valid. [TiKV 801: Region Merge](../tikv-801/index.md) explains why the source destruction and target snapshot need to be coordinated.

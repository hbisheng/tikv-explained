# Chapter Concept Map

This is an internal writing aid. It is not mdBook content and must not be added to `src/`.

Before writing a chapter, check its earlier dependencies. A term may be used without redefinition only when an earlier chapter has established its reader-level meaning. New code names need a local explanation, a reader-level replacement, or an explicit deferral.

## TiKV 101: What Is TiKV?

- **Introduces:** database, distributed database, TiDB, TiKV, storage layer, key-value store, key-value pair, low latency, transaction support, OLTP.
- **Core flow:** application data -> database -> TiDB -> TiKV stores and retrieves key-value pairs.
- **Deferred:** Regions, replication, Raft, SQL execution, transaction protocol.

## TiKV 201: The TiDB Ecosystem

- **Depends on:** TiKV and key-value store from 101.
- **Introduces:** PD, TiKV store, keyspace, Region, start key, end key, replica, Raft group, leader, follower, routing information, cluster metadata, scheduling, PD timestamps.
- **Core flow:** TiDB receives SQL -> routes a key to the Region leader -> TiKV serves it; PD maintains placement and routing information.
- **Deferred:** how Raft works, Region split and merge mechanics, transaction timestamp use.

## TiKV 301: TiKV Architecture

- **Depends on:** store and Region from 201.
- **Introduces:** RocksDB as TiKV's local KV engine, Raftstore, Raft consensus protocol, transaction layer, MVCC as a name, gRPC.
- **Core flow:** gRPC receives a request -> transaction layer gives it transaction meaning -> Raftstore distributes it -> RocksDB persists local data.
- **Deferred:** all component internals.

## RAFT 401: Raft Crash Course

- **Depends on:** Region replicas and leader/follower from 201; Raft from 301.
- **Introduces:** ordered log, log entry, total ordering, term, candidate, election timeout, vote, commit index, quorum, learner, AppendEntries, RequestVote.
- **Core flow:** leader appends writes -> followers replicate -> majority persists -> entry commits -> every replica applies entries in the same order.
- **Deferred:** TiKV's event loop and implementation API.

## RAFTSTORE 402: The Raft Event Loop

- **Depends on:** Raft messages, log entries, and commit from 401; Raftstore from 301.
- **Introduces:** `raft-rs`, `step`, `Ready`, `advance`, proposal API, peer FSM, state machine application.
- **Core flow:** event -> `raft-rs` decision -> `Ready` -> TiKV performs I/O and application -> `advance`.
- **Deferred:** storage engines, batching, and exact TiKV state-machine structures.

## ROCKSDB 403: RocksDB Intro

- **Depends on:** local KV engine from 301.
- **Introduces:** embedded KV store, sequence number, RocksDB snapshot, point lookup, range scan, `seek`, `next`, column family, `default` / `write` / `lock` CF.
- **Core flow:** writes create ordered versions -> a snapshot fixes one read position -> point lookup or scan reads through that position.
- **Deferred:** LSM tree, SST files, compaction, TiKV MVCC layout.

## TXN 404: Transaction Intro

- **Depends on:** PD timestamp from 201; column families and snapshots from 403; Regions and Raft groups from 201.
- **Introduces:** transaction, isolation level, snapshot isolation, `start_ts`, `commit_ts`, MVCC, committed version, primary key and secondary keys in the Percolator protocol, prewrite, transaction lock, rollback, `Put` and `Delete` write records.
- **Core flow:** begin at `start_ts` -> prewrite values and locks across Regions -> commit primary -> commit secondaries -> read the newest committed version visible at a timestamp.
- **Deferred:** latches, scheduler execution, lock resolution, Async Commit, 1PC.

## RAFTSTORE 501: Raftstore Write Flow

- **Depends on:** Raft log, commit, `Ready`, peer FSM, and `advance` from 401-402; RocksDB from 403.
- **Introduces:** Raft Engine, KV Engine, local command, proposal, apply system, mailbox, Raft batch system, apply batch system, apply index, `async_write`, `async_snapshot`.
- **Core flow:** local command -> propose -> persist and replicate -> commit -> apply to KV Engine -> callback; on restart, apply entries after the stored apply index.
- **Deferred:** the safety protocol for `async_snapshot`.

## RAFTSTORE 502: Linearizable Reads

- **Depends on:** `async_write`, `async_snapshot`, and apply completion from 501; RocksDB snapshot and sequence number from 403; Raft leadership and terms from 401.
- **Introduces:** linearizable read, lease read/local read, leader lease, ReadIndex, current-term application requirement.
- **Core flow:** completed writes must be visible -> valid lease permits a local snapshot -> otherwise ReadIndex confirms leadership -> take RocksDB snapshot.
- **Deferred:** replica reads and detailed ReadIndex message format.

## COP 503: Coprocessor Intro

- **Depends on:** SQL/TiDB from 101 and 201; Region and key range from 201; RocksDB scan from 403; `async_snapshot` from 501-502.
- **Introduces:** computation pushdown, coprocessor (cop), cop task, operator, filter, aggregation, TopN, table/index key range, read pool.
- **Core flow:** TiDB splits a query by Region -> sends cop tasks -> each task gets a snapshot, scans a key range, runs operators -> TiDB combines partial results.
- **Deferred:** exact key encoding, executor implementation, query-plan patterns, read-pool scheduling.

## RAFT 601: Leader Transfer

- **Depends on:** PD scheduling from 201; leadership, terms, elections, AppendEntries, and quorum from 401; `raft-rs` and Raftstore event processing from 402.
- **Introduces:** active leader transfer, candidate set, transfer target, `MsgTransferLeader`, transfer acknowledgement, caught-up threshold, `MsgTimeoutNow`.
- **Core flow:** PD supplies acceptable targets -> TiKV chooses a caught-up target -> target acknowledges -> leader stops proposals and catches it up -> `MsgTimeoutNow` triggers a normal safe election.
- **Deferred:** in-memory pessimistic-lock handoff in 803.

## RAFT 602: Replica Movement

- **Depends on:** PD scheduling, store, Region, replica, and peer placement from 201; learner, voting peer, quorum, log replication from 401; Raftstore apply path from 501; leader transfer distinction from 601.
- **Introduces:** Region metadata, Region configuration, configuration change/conf change, `propose_conf_change`, `apply_conf_change`, uninitialized peer, durable removal state.
- **Core flow:** PD chooses source and target -> leader proposes a conf-change entry -> Raft commits it -> Raftstore persists updated Region metadata -> `raft-rs` updates in-memory configuration -> a new learner catches up -> it becomes a voter -> old peer is removed.
- **Deferred:** the durable Region-state record, peer lifecycle code structures, snapshot delivery, and lifecycle races in 603 and 901.

## RAFT 603: Raft Snapshot

- **Depends on:** Raft log, commit, and log replication from 401; Raft Engine, KV Engine, apply index, and apply system from 501; RocksDB snapshot from 403; Region metadata and uninitialized peer from 602.
- **Introduces:** bulk copy and incremental catch-up, log truncation, state at a Raft position, Raft snapshot, snapshot index and term, SST files, `PeerStorage`, temporarily unavailable snapshot generation, snapshot worker pool, and separate snapshot transfer.
- **Core flow:** follower is too far behind for retained logs -> leader creates a snapshot at a Raft position -> transfers metadata and data -> receiver passes it to local storage work -> ordinary log replication continues after installation.
- **Deferred:** receiving-side cleanup and SST ingestion in 703; crash-safe state transitions and two-engine recovery in 901.

## RAFTSTORE 604: Region Split

- **Depends on:** Region ranges and PD scheduling from 201; Raft admin changes and apply from 401 and 501; snapshot-based peer creation from 603 at a high level; Region metadata from 602.
- **Introduces:** split as a Region-topology change without data movement, approximate Region size, split check, split key, PD-allocated Region and peer IDs, default right-derived split, Region epoch/version, `RegionLocalState`, child Region peer.
- **Core flow:** size check or PD request -> find or receive split key -> ask PD for IDs -> leader proposes split -> Raft commits -> every replica persists updated `RegionLocalState` -> new Region peer starts with its own Raft state.
- **Deferred:** split creation races, snapshots, and durable peer metadata in 901.

## ROCKSDB 605: RocksDB LSM Tree

- **Depends on:** RocksDB versions, scans, and column families from 403.
- **Introduces:** WAL, memtable, immutable memtable, flush, SST data/index blocks, LSM levels, L0 overlap, non-overlapping deeper levels, compaction, atomic compaction publication, base level, and dynamic level bytes.
- **Core flow:** WAL append -> active memtable -> immutable memtable at its size threshold -> background flush to L0 SST -> compaction moves and merges pressured levels -> dynamic sizing activates only the needed deeper levels.
- **Deferred:** flow control, compaction candidate expansion, concurrency, and output-file guards in 704; writer grouping, prefix seeks, Bloom filters, and detailed configuration.

## COP 606: Coprocessor Patterns

- **Depends on:** cop task, Region-scoped scans, and read pool from 503; RocksDB scans from 403; snapshot from 501-502.
- **Introduces:** simplified TiDB row/index encoding, table ID, index ID, clustered and nonclustered primary-key layouts, hidden `_tidb_rowid`, row handle, unique/non-unique index layout, table range scan, index scan, index lookup, back-to-table read, seek versus `next`, index join, hash join build/probe roles, and operator semantics, partial versus final aggregation, and DAG pull flow.
- **Core flow:** TiDB encodes rows and indexes into ordered key intervals -> query access selects a row or index interval -> each Region task takes a snapshot, scans or seeks the needed keys, runs its operators -> TiDB combines partial results.
- **Deferred:** exact byte encoding, code-level executor implementation, task yielding, concurrency/resource limits, cop timing, and iterator statistics in 707.

## TXN 607: Transaction Scheduler

- **Depends on:** transaction protocol, MVCC records, locks, prewrite, and primary keys from 404; `async_write`/`async_snapshot` from 501-502; standalone read-pool requests from 503.
- **Introduces:** Region-scoped transaction command, transaction scheduler, latch, hash slot, write conflict, optimistic and pessimistic transactions, lock resolution, and primary status check.
- **Core flow:** Region command -> latch acquisition -> snapshot and MVCC/lock reads -> conflict checks -> prepare CF changes -> `async_write` -> release latch and completion.
- **Deferred:** exact concurrency-manager behavior, in-memory pessimistic locks, and scheduler performance metrics.

## RAFTSTORE 701: Batch System

- **Depends on:** peer FSM, `Ready`, and Raft event loop from 402; mailbox, Raft batch system, apply batch system, Raft Engine, KV Engine, and apply index from 501.
- **Introduces:** Router, mailbox routing and scheduling, poller, batch round, batch-size target, rescheduling, shared apply `WriteBatch`, ApplyFsm yielding, and per-Region ordering across shared workers.
- **Core flow:** event -> Router finds mailbox -> mailbox queues event and schedules peer FSM -> poller processes a batch of FSMs -> Raft `Ready` work is batched -> committed entries reach ApplyFsms -> KV Engine work is batched.
- **Deferred:** code-level handler/delegate structure, configuration and performance tuning, batch-system metrics, exact I/O worker behavior, and detailed slow-score and Region-worker implementation in 702-703.

## RAFTSTORE 702: Slow Score

- **Depends on:** PD's cluster-wide role from 201; Raft Engine, KV Engine, and the Raftstore write path from 501; leader transfer from 601; pollers and Raft batch rounds from 701.
- **Introduces:** alive-but-slow store, Raft-disk inspection, separate KV-disk probe, shared versus separate disk paths, inspection timeout, inspection round, timeout ratio, slow score, asymmetric increase and recovery, and PD leader eviction.
- **Core flow:** TiKV periodically inspects the Raft disk and, when separate, the KV disk -> an unfinished inspection times out -> every 30 checks, timeouts raise the path's score multiplicatively while healthy rounds lower it linearly -> TiKV reports the larger disk score to PD -> PD transfers leaders away when the score reaches 100.
- **Deferred:** implementation-level probe stages, CPU-busy filtering, network slow score, slow-trend detection, metrics and tuning, and operational diagnosis of a high score.

## RAFTSTORE 703: Region Worker

- **Depends on:** RocksDB snapshots and sequence numbers from 403; SST files and LSM basics from 605; Raftstore apply and KV Engine from 501; Raft snapshot semantics, generation, and transfer from 603; Region metadata and `RegionLocalState` from 604.
- **Introduces:** snapshot-generation handoff, Region worker, delayed Region-data deletion, deletion sequence, oldest active snapshot sequence, whole-file deletion, boundary-key deletion, snapshot-range reservation, deferred overlapping deletion, SST ingestion, and L0 apply admission.
- **Core flow:** a removed replica records its obsolete range and sequence -> older read snapshots finish -> whole SST files and remaining boundary keys are removed; an incoming snapshot reserves its range -> Region worker drains overlapping deferred deletion -> ingests snapshot SSTs, unless L0 pressure defers the task.
- **Deferred:** durable snapshot-application markers, exact worker scheduling, merge/split-specific overlap handling, and crash-recovery races with peer creation in 901.

## ROCKSDB 704: RocksDB Details

- **Depends on:** WAL, memtables, SST files, levels, and compaction from 605; Raftstore apply from 501; Region data cleanup from 703.
- **Introduces:** immutable memtable backlog, L0 backlog, pending compaction bytes, TiKV flow control, byte-rate delay, busy rejection, compaction picker, seed file, overlap expansion, background-job budget, subcompaction, and Region-aware compaction guard.
- **Core flow:** storage pressure delays or rejects writes before Raftstore -> a picker expands a seed into a complete non-conflicting file set -> bounded jobs and subcompactions rewrite its key ranges in parallel -> a guard can cut the output SSTs at Region boundaries.
- **Deferred:** configuration values and tuning, metrics, code-level flow-controller and compaction-picker algorithms, and the RocksDB writer-group and prefix-seek paths.

## ROCKSDB 705: Titan

- **Depends on:** the `default`, `write`, and `lock` CF roles and MVCC history from 404; RocksDB snapshots from 403; WAL, memtables, SST files, LSM levels, flush, compaction, and write amplification from 605 and 704.
- **Introduces:** Titan, key-value separation, blob file, `BlobIndex`, the flush/compaction separation point, blob-read indirection, live and discardable blob records, discardable ratio, and blob garbage collection.
- **Core flow:** full value passes through WAL and memtable -> SST construction keeps a small value inline or writes a large value to a blob file -> SST stores its `BlobIndex` -> ordinary compaction moves the index -> obsolete LSM references make blob bytes discardable -> blob GC copies live values, updates their indexes, and retires the old files.
- **Deferred:** Titan's optional level-merge and range-merge modes, blob cache internals, GC batching and crash-consistency implementation, detailed tuning and metrics, and the transaction-GC and compaction-filter mechanics in 804.

## COP 706: YATP Internals

- **Depends on:** cop task and read-pool workers from 503; direct storage reads from 403.
- **Introduces:** worker thread, task, Rust Future, executor, `poll()`, `Ready`, `Pending`, waker, `NOTIFIED`/`POLLING`/`IDLE`/`COMPLETED`, cooperative scheduling, unified read pool, work stealing, and single-level, multi-level, and priority queues.
- **Core flow:** ready Future is queued as `NOTIFIED` -> worker marks it `POLLING` and calls `poll()` -> `Ready` completes the task or `Pending` leaves it `IDLE` -> external progress invokes its waker -> task becomes `NOTIFIED` and is scheduled again.
- **Deferred:** cop-specific yield points, timing boundaries, saturation metrics, concurrency and resource limits, and iterator statistics to 707; exact queue internals, task-state races, pool scaling, admission control, and deployment/version history.

## COP 707: Coprocessor Execution

- **Depends on:** cop task, access patterns, seek, scan, and operators from 503 and 606; cooperative task execution and read pools from 706; MVCC/iterator context from 403-404.
- **Introduces:** request handler, range-scanner yield checks, resource-control admission, heavy-task concurrency limit, cop request timing boundaries, YATP execution signals, and TiKV/RocksDB scan statistics.
- **Core flow:** parse request -> admit and enqueue task -> obtain Region snapshot -> build handler -> poll operators and scan RocksDB -> yield at scanner checks -> return results and report timing and storage work.
- **Deferred:** streaming implementation details, admission and quota algorithms, dashboard-specific diagnosis, and the exact RocksDB iterator implementation.

## TXN 708: Async Commit and 1PC

- **Depends on:** RocksDB snapshots from 403; 2PC, prewrite, primary and secondary keys, transaction locks, `write` CF, `default` CF, and MVCC visibility from 404; lock resolution from 607.
- **Introduces:** Async Commit, `min_commit_ts`, recovery metadata, secondary-key list, background commit, one-phase commit (1PC), concurrency manager, `max_ts`, and the in-memory lock table.
- **Core flow:** Async Commit prewrites every key with enough participant and timestamp information to recover one outcome, then moves commit RPCs out of the foreground; 1PC commits one Region's mutations directly in one prewrite batch; the concurrency manager orders concurrent reads against these prewrites until their state reaches RocksDB.
- **Deferred:** exact protocol eligibility limits and fallback matrix, recovery RPC formats, asynchronous apply implementation, concurrency-manager data structures, and performance tuning.

## RAFTSTORE 801: Region Merge

- **Depends on:** Region ranges and PD scheduling from 201; Raft logs, commit, and ordered application from 401 and 501; matched index from 601; peer placement and movement from 602; Region metadata and epochs from 602 and 604.
- **Introduces:** adjacent source and target Regions, peer alignment before merge, two-Raft-group coordination, `PrepareMerge`, retained source-log interval, `CommitMerge`, fixed merge boundary, local source catch-up, and `RollbackMerge` before target commit.
- **Core flow:** PD aligns source peers with target peers -> source leader chooses a boundary all source peers can reach -> `PrepareMerge` freezes the source history -> target group commits `CommitMerge` with the required source logs -> each local source catches up -> target range and source removal are persisted together.
- **Deferred:** exact merge-state records, snapshot and peer-GC races, repeated merges, tablet-specific implementation, and crash recovery in 901.

## RAFTSTORE 802: Raft Hibernation

- **Depends on:** Raft heartbeat, election timeout, and leader/follower roles from 401; Raftstore workers and apply progress from 501.
- **Introduces:** base tick, logical Raft clock, hibernation, leader-side hibernation polling, skipped ticks, stale check, and the `Idle`, `PreChaos`, `Chaos`, and `Ordered` states.
- **Core flow:** stable followers pass local checks -> leader verifies replication and apply progress -> leader gathers hibernation responses -> normal base ticks stop -> commands and Raft messages wake peers directly, while stale checks recover from a failed leader.
- **Deferred:** exact wake-up sites, compatibility handling during rolling upgrades, busy-apply recheck history, and hibernation metrics.

## TXN 803: In-Memory Pessimistic Locks

- **Depends on:** leader transfer, Raft log order, terms, and `MsgTransferLeader` from 601 and 401; pessimistic transactions, transaction locks, `lock` CF, MVCC checks, and the scheduler write path from 607; the concurrency manager's in-flight lock table from 708; Region version changes from 604 and 801.
- **Introduces:** in-memory pessimistic lock as a volatile writer reservation, leader-local lock table, pipelined-locking prerequisite, term/version validation, persistent fallback, pending removal, unexpected-loss retry semantics, lock-table freeze, transfer apply fence, and the second acknowledgement.
- **Core flow:** eligible lock acquisition -> MVCC checks merge the memory table with `lock` CF -> store the reservation on the leader -> later prewrite or rollback changes `lock` CF and removes the memory entry after apply; planned transfer -> freeze the table -> persist live locks -> apply a transfer fence on the target -> return a second acknowledgement -> begin normal Raft leader transfer.
- **Deferred:** shared-lock behavior, exact memory accounting and configuration, split/merge migration races, flashback interaction, and the full durable peer lifecycle in 901.

## ROCKSDB 804: GC and Compaction Filter

- **Depends on:** timestamped MVCC versions, `write` CF, `default` CF, transaction locks, and `Put`/`Delete` records from 404; LSM levels and compaction from 605.
- **Introduces:** GC lifetime, transaction safe point, GC safe point, boundary `Put`, traditional GC, compaction filter, bottommost-level `Delete` cleanup, and logical versus physical MVCC cleanup.
- **Core flow:** GC lifetime produces a target -> the transaction safe point stops older transactions -> their locks are resolved -> the GC safe point is published -> a boundary `Put` and all newer versions remain, while older history is removed -> direct GC scans keys or the compaction filter removes versions as `write` CF SST files compact -> a boundary `Delete` is removed only after the history it hides is gone.
- **Deferred:** service safe points and other safe-point blockers, GC scheduling, cleanup failure recovery, compaction-filter thresholds, and production tuning and metrics.

## RAFTSTORE 901: Raft Peer Lifecycle

- **Depends on:** all earlier Region, Raft, Raftstore, snapshot, split, merge, and replica-movement concepts.
- **Introduces:** detailed `RaftLocalState`, `RaftApplyState`, `PeerState`, tombstone, apply marker, startup reconstruction, `pending_snapshot_regions`, `pending_create_peers`, peer garbage collection, durable merge/snapshot races.
- **Core flow:** every peer lifecycle operation becomes a durable state transition -> restart rebuilds in-memory peers from that state -> recovery resumes unfinished work safely.
- **Deferred:** none; this is the code-oriented lifecycle reference chapter.

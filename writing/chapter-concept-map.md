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
- **Introduces:** bulk copy and incremental catch-up, log truncation, state at a Raft position, Raft snapshot, snapshot index and term, SST files, `PeerStorage`, temporarily unavailable snapshot generation, snapshot worker pool, separate snapshot transfer, Region workers, SST ingestion, range cleanup.
- **Core flow:** follower is too far behind for retained logs -> leader creates a snapshot at a Raft position -> transfers metadata and data -> receiver cleans the range and ingests SST files -> normal log replication resumes.
- **Deferred:** crash-safe state transitions and two-engine recovery in 901.

## RAFTSTORE 604: Region Split

- **Depends on:** Region ranges and PD scheduling from 201; Raft admin changes and apply from 401 and 501; snapshot-based peer creation from 603 at a high level; Region metadata from 602.
- **Introduces:** split as a Region-topology change without data movement, approximate Region size, split check, split key, PD-allocated Region and peer IDs, default right-derived split, Region epoch/version, `RegionLocalState`, child Region peer.
- **Core flow:** size check or PD request -> find or receive split key -> ask PD for IDs -> leader proposes split -> Raft commits -> every replica persists updated `RegionLocalState` -> new Region peer starts with its own Raft state.
- **Deferred:** split creation races, snapshots, and durable peer metadata in 901.

## ROCKSDB 605: RocksDB Details

- **Depends on:** RocksDB versions, scans, and column families from 403.
- **Introduces:** memtable, flush, detailed SST-file structure, LSM level, compaction, base level, dynamic level bytes, compaction candidate, clean cut, compaction guard, prefix seek, bloom filter, write batch, WriteThread, write group, WAL group commit.
- **Core flow:** writes enter a write group -> WAL and memtable -> flush to SSTs -> compaction selects and rewrites files across levels.
- **Deferred:** workload-specific tuning and code-level picker implementation.

## COP 606: Coprocessor Operators

- **Depends on:** cop task, operators, read pool, and Region-scoped scans from 503; RocksDB scans from 403; MVCC column families from 404; cooperative scheduling from 705 for its detailed queueing model.
- **Introduces:** table key, row ID, index key, unique/non-unique index, executor DAG, pull execution, TableReader, IndexReader, IndexLookup, HashJoin, IndexJoin, yield point, concurrency limiter, resource control, cop timing metrics, iterator statistics.
- **Core flow:** TiDB encodes table/index access -> executor chain pulls rows from a snapshot -> scan yields by policy -> TiKV reports task and iterator work.
- **Deferred:** full SQL planning and exact storage encodings.

## TXN 607: Transaction Scheduler

- **Depends on:** transaction protocol, MVCC records, locks, and prewrite from 404; `async_write`/`async_snapshot` from 501-502; read-pool distinction from 503 and 705.
- **Introduces:** transaction scheduler, latch, hash slot, write conflict, pessimistic lock, resolve lock, primary status check, scheduler stages and metrics.
- **Core flow:** command -> snapshot and MVCC/lock reads -> latch acquisition -> conflict checks -> prepare CF changes -> `async_write` -> completion.
- **Deferred:** exact concurrency-manager behavior and production diagnosis details.

## RAFTSTORE 701: Batch System

- **Depends on:** peer FSM, `Ready`, and Raft event loop from 402; mailbox, Raft batch system, apply batch system, Raft Engine, KV Engine, and apply index from 501.
- **Introduces:** Router, mailbox routing and scheduling, poller, batch round, batch size, `messages-per-tick`, rescheduling, ApplyFsm yielding, `apply-yield-write-size`, Process Ready Duration, apply log, apply wait.
- **Core flow:** event -> Router finds mailbox -> mailbox queues event and schedules peer FSM -> poller processes a batch of FSMs -> Raft `Ready` work is batched -> committed entries reach ApplyFsms -> KV Engine work is batched.
- **Deferred:** code-level handler/delegate structure, configuration tuning methodology, exact I/O worker behavior, and detailed slow-score and Region-worker implementation in 702-703.

## RAFTSTORE 702: Slow Score

- **Depends on:** Raftstore write and apply path from 501; PD's scheduling role from 201.
- **Introduces:** slow score, latency inspection probe, inspect interval, timeout ratio, decay, health reporter, busy apply.
- **Core flow:** periodic probe enters Raftstore -> callback records completion or timeout -> each round raises or lowers slow score -> PD uses it as a health signal.
- **Deferred:** scheduling decisions that consume the score.

## RAFTSTORE 703: Region Worker

- **Depends on:** RocksDB snapshots and sequence numbers from 403; Raftstore apply and KV Engine from 501; Raft snapshot semantics, generation, and transfer from 603; Region metadata and `RegionLocalState` from 604.
- **Introduces:** Region worker, snapshot application cleanup, valid overlapping metadata, delayed Region deletion, oldest active snapshot sequence, SST-contained file deletion, key-based deletion, deletion-SST legacy path.
- **Core flow:** generate snapshot or receive deletion/apply work -> protect active readers and Region ownership -> clean stale range -> delete files or keys, or ingest snapshot SSTs -> finish the local Region transition.
- **Deferred:** detailed worker scheduling and crash-recovery races in 901.

## ROCKSDB 704: Titan

- **Depends on:** RocksDB snapshots and versions from 403; memtables, SST files, LSM levels, flush, and compaction from 605; MVCC versions and retained history from 404.
- **Introduces:** value separation, `min-blob-size`, blob file, `BlobIndex`, discardable blob record, discardable ratio, blob garbage collection, live and obsolete blob data, blob lookup, and the compaction-I/O tradeoff.
- **Core flow:** large value -> blob file plus small LSM reference -> compaction rewrites references -> obsolete references make blob records discardable -> ratio-based background GC rewrites live values and references -> old blob file is removed.
- **Deferred:** Titan's optional level-merge mode, detailed blob cache behavior, exact implementation internals, and production tuning and metrics.

## TiKV 705: YATP Internals

- **Depends on:** read pool from 503.
- **Introduces:** process, thread, task, thread pool, cooperative executor, future, poll, `Pending`, waker, single-level/multi-level/priority queues, unified read pool, task states, read-pool metrics.
- **Core flow:** submitted task -> queue -> worker polls -> task finishes or returns `Pending` -> waker reschedules it.
- **Deferred:** exact pool selection in a particular deployment and scheduler-worker implementation.

## TXN 706: Async Commit and 1PC

- **Depends on:** RocksDB snapshots from 403; 2PC, prewrite, transaction lock, `write` CF, `default` CF, and MVCC visibility from 404.
- **Introduces:** Async Commit, async-commit metadata, concurrency manager, `max_ts`, in-memory lock table, and one-phase commit (1PC).
- **Core flow:** Async Commit leaves enough information in a lock to determine the committed result before later cleanup; the concurrency manager orders concurrent reads and prewrites, and exposes a lock until RocksDB contains it; 1PC writes committed MVCC state in the prewrite request.
- **Deferred:** eligibility checks, resolver mechanics, concurrency-manager internals, and performance tradeoffs.

## RAFTSTORE 801: Region Merge

- **Depends on:** Region range and scheduling from 201; Region metadata and peer placement from 602; Raft logs, commit, and follower match position from 401; Raftstore application from 501.
- **Introduces:** adjacent source and target Regions, aligned peer placement, `PrepareMerge`, `CommitMerge`, matched index, merge boundary, frozen source, source log catch-up, expanded target range, and merge rollback before target commit.
- **Core flow:** PD aligns adjacent Regions and peers -> source leader checks replication lag and proposes `PrepareMerge` -> source group commits and applies it, freezing writes -> target leader proposes `CommitMerge` carrying the needed source history -> source peers catch up -> target expands its range and source peers disappear.
- **Deferred:** detailed durable merge lifecycle, exact peer state records, and crash races in 901.

## RAFTSTORE 802: Raft Hibernation

- **Depends on:** Raft heartbeat, election timeout, and leader/follower roles from 401; Raftstore workers and apply progress from 501.
- **Introduces:** tick, logical clock, hibernation, group idle state, stale check, `Polling`, `Idle`, `PreChaos`, `Ordered`, `Chaos`, missing ticks.
- **Core flow:** quiet group negotiates hibernation -> slows normal ticks -> stale checks retain failure detection -> activity or failure wakes normal ticking.
- **Deferred:** exact timer configuration and busy-apply recovery implementation.

## TXN 803: In-Memory Pessimistic Locks

- **Depends on:** leader transfer, Raft log order, terms, and `MsgTransferLeader` from 601 and 401; transaction locks, `lock` CF, MVCC conflict checks, and `async_write` from 404 and 607.
- **Introduces:** in-memory pessimistic lock, leader-local lock table, pipelined locking prerequisite, table term/version, pending removal, transferring state, lock flush, transfer admin-command fence, and second command-reply acknowledgement.
- **Core flow:** eligible lock acquisition -> leader-local table -> readers check memory then `lock` CF -> later lock-CF change removes the table entry after apply; voluntary transfer -> freeze table -> replicate live locks -> apply transfer fence -> target sends second acknowledgement -> run normal Raft transfer.
- **Deferred:** shared-lock details, exact memory accounting, split and merge handling, and the full durable peer lifecycle in 901.

## ROCKSDB 804: GC and Compaction Filter

- **Depends on:** timestamped MVCC versions, `write` CF, `default` CF, transaction locks, and `Put`/`Delete` records from 404; LSM levels and compaction from 605.
- **Introduces:** GC lifetime, transaction safe point, GC safe point, retained boundary version, traditional GC, compaction filter, bottommost level, and logical versus physical MVCC cleanup.
- **Core flow:** GC lifetime advances a safe point -> old locks are resolved -> each key retains its boundary version -> traditional GC scans and deletes obsolete `write`/`default` records together, or a compaction filter removes them when their SST files compact -> delete records remain until the bottommost level.
- **Deferred:** GC scheduling, service safe points, compaction-filter failures, and production tuning and metrics.

## RAFTSTORE 901: Raft Peer Lifecycle

- **Depends on:** all earlier Region, Raft, Raftstore, snapshot, split, merge, and replica-movement concepts.
- **Introduces:** detailed `RaftLocalState`, `RaftApplyState`, `PeerState`, tombstone, apply marker, startup reconstruction, `pending_snapshot_regions`, `pending_create_peers`, peer garbage collection, durable merge/snapshot races.
- **Core flow:** every peer lifecycle operation becomes a durable state transition -> restart rebuilds in-memory peers from that state -> recovery resumes unfinished work safely.
- **Deferred:** none; this is the code-oriented lifecycle reference chapter.

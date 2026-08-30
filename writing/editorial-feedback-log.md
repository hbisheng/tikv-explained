# Editorial Feedback Log

This internal log records editorial feedback and the resulting changes. It is not mdBook content and must not be added to `src/`.

Entries are newest first. Each entry has two plain paragraphs: the user's distilled intent, then the resulting changes. Durable rules belong in `skills/tikv-explained-editing/SKILL.md`, not here.

## 2026-08-30 12:54 CST - Start COP 706 at the Read-Pool Task Boundary

COP 706 should begin with the direct fact that TiKV represents a cop request as a task in the unified read pool, not a process-and-thread recap. Explain the pool through workers and tasks, introduce Future polling before YATP's state machine, and explain `Pending` positively as a worker becoming available for other work. The single-level queue needs the actual new-task route rather than merely naming local queues and work stealing.

Rewrote the opening around cop tasks and the unified read pool, removed the TiKV 201 detour and duplicate pool section, and made the Future section executor-neutral before entering YATP's states. The single-level description now says that externally submitted tasks enter the shared injector, workers pull batches into local queues, and idle workers steal batches when needed. Updated the concept map to remove the unnecessary process dependency.

## 2026-08-30 01:45 CST - Rebuild ROCKSDB 804 Around the Safe-Point Boundary

ROCKSDB 804 should receive the same source-checked pre-review treatment as 801 through 803. It needs to derive MVCC garbage collection from the history guarantee established in TXN 404, introduce transaction and GC safe points in their actual order, and distinguish the logical decision that history is obsolete from the physical mechanism that removes it. The chapter must not claim that every key always retains one version at or below the safe point, blur a TiKV MVCC `Delete` with a RocksDB deletion marker, or imply that a compaction over `write` CF can silently clean `default` CF as part of the same SST output.

Rebuilt 804 around GC lifetime, transaction-safe-point lock resolution, GC-safe-point publication, and separate boundary rules for `Put` and `Delete`. The direct path now follows one key through paired `write`/`default` CF mutations. The compaction-filter path explains opportunistic `write` CF cleanup, its separate `default` CF deletion batch, and why a boundary `Delete` remains until bottommost-level cleanup can remove everything it hides. Updated the concept map after checking the TiDB GC ordering and the traditional GC and compaction-filter implementations in the local TiKV checkout.

## 2026-08-30 01:38 CST - Rebuild TXN 803 Around a Volatile Reservation

TXN 803 should receive the same source-checked pre-review treatment as 801 and 802. The chapter needs to establish what a pessimistic lock means before optimizing it, distinguish this feature from the concurrency manager, and explain why losing a leader-local lock may cause a retry without causing an incorrect commit. The leader-transfer path must preserve the exact ordering and evidence: freeze new memory locks, persist the live reservations, apply an ordered fence on the target, receive the second acknowledgement, and only then enter `raft-rs` leader transfer. Code-level table statuses and race bookkeeping should support that model rather than become the chapter structure.

Rebuilt 803 from one writer-reservation example. The chapter now contrasts persistent and in-memory acquisition, explains the merged memory/`lock` CF view, term and Region-version validation, persistent fallback, and removal only after a later Raft command applies. It derives unexpected lock loss from the reservation semantics, then follows planned leader transfer through table freezing, exclusion of pending-removal entries, lock persistence, the `TransferLeader` apply fence, and the second acknowledgement. Removed configuration values, shared-lock details, and code-status narration; updated the concept map after checking both Raftstore implementations, the scheduler, MVCC reader, and transfer-leader tests in the local TiKV checkout.

## 2026-08-30 01:29 CST - Rebuild RAFTSTORE 802 Around Tick Suppression

RAFTSTORE 802 should receive the same source-checked pre-review treatment as the other later chapters. It needs to begin with the concrete cost of ticking many idle Region peers, distinguish follower-local checks from the leader's group-wide decision, and explain how TiKV can stop normal ticks without presenting hibernation as part of the basic Raft protocol. The failure path must be honest about the tradeoff: stale checks preserve a route back to election, but leader failure is detected more slowly. Internal states should appear only after their purpose is clear, and the old busy-apply fix history should not interrupt the main mechanism.

Rebuilt 802 around base ticks, eligibility, hibernation agreement, direct wake-up, and failed-leader detection. The chapter now derives the CPU benefit from the many-Region model in 701, explains the leader's replication/apply checks and quorum responses, and gives the two-check polling delay and skipped-tick behavior their correctness purpose. It introduces `Idle`, `PreChaos`, `Chaos`, and `Ordered` through the stale-check flow, states the five-minute default and slower recovery tradeoff, removes the code-history section, and updates the concept map. The behavior and defaults were checked against the local TiKV hibernation state, peer tick, and integration-test code.

## 2026-08-30 01:18 CST - Rebuild RAFTSTORE 801 Around Two Raft Groups

RAFTSTORE 801 should receive the same source-checked pre-review treatment as the detailed Level 7 chapters. Region merge must be understandable as a protocol, not as a sequence of code callbacks: explain why combining two independent Raft groups needs two commands, what source and target each decide, why peer placement is aligned first, and why source-log catch-up is required on every store. Keep lifecycle races and crash-state machinery for 901, but do not hide a correctness boundary behind vague phrases such as “necessary logs” or “finish the metadata change.”

Rebuilt 801 from the split-to-merge transition and one concrete pair of key ranges. Added the preliminary replica-alignment step and distinguished its possible data movement from the metadata-oriented merge itself. Derived `min_matched`, the retained log interval, and source freezing before introducing `PrepareMerge`; then followed `CommitMerge` through target-group commitment, per-store source catch-up, and the paired target/source metadata update. Clarified the rollback point, removed duplicated full-flow narration, updated the concept map, and checked the stages against both current Raftstore implementations in the local TiKV checkout and PD's merge operator.

## 2026-08-30 00:59 CST - Reduce ROCKSDB 704 to Flow Control and Compaction

ROCKSDB 704 did not need to be a survey of every RocksDB detail. Drop concurrent write grouping and prefix seeking. Keep the one pressure-to-compaction path: TiKV flow control, the compaction picker, compaction parallelism, and Region-aware output files. Explain each directly and leave parameters and internal mechanics out.

Rebuilt 704 as those four sections. The flow-control section keeps its pre-Raftstore boundary and the distinction between byte-rate delay and busy rejection. The rest follows one compaction from picker selection, through bounded jobs and subcompactions, to compaction-guard cuts at Region boundaries and their benefit to Region cleanup. Removed writer grouping, prefix seek, configuration landmarks, and surplus diagrams; updated the concept map to defer them.

## 2026-08-29 23:51 CST - Reduce RAFTSTORE 703 to the Three Region-Data Jobs

RAFTSTORE 703 had too many terms and side paths. It should introduce only the three related background jobs: hand off snapshot generation, apply a received snapshot, and remove destroyed-Region data. Start with destruction, derive the sequence-number wait from ongoing reads, then explain whole-file versus boundary-key deletion. Snapshot application needs one precise distinction: range checks prevent a live or pending metadata conflict, but a destroyed peer can leave deferred physical data that must be cleared before ingestion. State the L0 admission boundary plainly and leave the rest out.

Rebuilt 703 around that order. It now identifies the Region worker directly as a Raftstore component, lists its three responsibilities, then gives snapshot generation one forwarding sentence before destruction and application. The chapter records a removed replica's range and sequence, then completes destruction with whole-file and boundary-key deletion. Snapshot apply distinguishes live metadata from deferred physical cleanup, forces overlapping deferred deletion before SST ingestion, and states the default more-than-10-L0-files delay. Updated the concept map to match and deferred lifecycle-specific overlap cases.

## 2026-08-29 23:36 CST - Rebuild TXN 708 Around the Commit Decision

TXN 708 should not describe Async Commit as though one remaining lock simply proves that the transaction committed. The chapter needs to start from the foreground wait in classic 2PC, then explain exactly what replaces that primary-commit decision: every lock carries a minimum commit timestamp, the primary records the secondary keys, and the complete persisted participant state makes one outcome recoverable. 1PC should be equally concrete about its boundary: all mutations fit in one prewrite batch for one Region, so TiKV can write the committed MVCC records directly. The Concurrency Manager belongs only after these paths are clear, where it can solve the specific race between timestamped reads and state not yet visible in RocksDB.

Rebuilt 708 in that order and checked the protocol against the local TiKV source and the client-go version used by the local TiDB checkout. The new chapter separates `min_commit_ts` from the final `commit_ts`, explains all-secondary recovery rather than single-lock inference, identifies TiDB's foreground and background work, gives 1PC its one-Region boundary, and derives `max_ts` plus the in-memory lock table from two concrete race orderings. Updated the concept map and added the durable rule that a protocol optimization must explain what correctness evidence replaces the step it removes.

## 2026-08-29 23:18 CST - Distinguish Slow Classification from Leader Eviction

RAFTSTORE 702 must not confuse PD's slow-store classification with its leader-eviction action. A score of 80 marks a Store as slow, but the disk slow-store scheduler begins leader eviction only at 100. The chapter's purpose is the action that protects request latency, so it should state only the latter threshold rather than introducing a distinction it does not need to explain.

Corrected 702 and its concept map to say that PD transfers leaders once the single slow Store reaches 100. Recorded the 80-versus-100 boundary after checking the local PD scheduler: 80 is the `IsSlow` classification threshold, while the eviction scheduler requires a score of at least 100.

## 2026-08-29 23:00 CST - Rebuild COP 707 Around One Request's Execution

COP 707 should receive the same source-checked, pre-review treatment as 702 through 706. It must connect COP 606's storage access patterns to COP 706's Future lifecycle without turning into a loose metrics catalog. Yielding, resource admission, read-pool scheduling, concurrency limits, and iterator statistics need distinct boundaries, and names such as `item`, `wait`, and `running tasks` must not be interpreted casually.

Rebuilt 707 around one cop request from parsing through snapshot acquisition, handler construction, cooperative scanning, and response. Corrected the scanner from a fixed 32-row yield to elapsed-time checks at new ranges and every 32 returned keys, explained the non-strict 1 ms boundary, and separated resource-control admission from the heavy-task semaphore. Re-derived cop and YATP timing signals from their actual instrumentation, corrected Running Tasks to include all admitted unfinished tasks, and distinguished TiKV MVCC iterator operations from RocksDB internal skipped-key counters. Updated the concept map and added a durable rule requiring metric prose to preserve the actual measurement boundary.

## 2026-08-29 22:49 CST - Rebuild COP 706 Around the Future Lifecycle

COP 706 should receive the same pre-review treatment as the preceding detailed chapters. The old draft buried YATP's actual programming model beneath generic process and thread background, a cross-version pool table, and a metrics catalog already better suited to 707. It also described multi-level queues as if they assigned longer time slices to lower levels, without first making the cooperative `poll()` boundary precise.

Rebuilt 706 around one cop task waiting for a Region snapshot. It now distinguishes TiKV tasks from worker threads, derives `poll()`, `Pending`, and wakers from that wait, then introduces YATP's four task states and the boundary between OS preemption and cooperative Future scheduling. The unified read-pool scope and single-level, multi-level, and priority queues now follow the core loop; the multi-level description uses accumulated execution time rather than invented time-slice lengths. Version history and metrics moved out of the chapter, 707 receives the cop-specific performance details, and the concept map was updated from the pinned local YATP and TiKV source.

## 2026-08-29 22:48 CST - Reduce RAFTSTORE 702 to the Slow-Store Decision

RAFTSTORE 702 should keep only the full slow-store decision: a TiKV can be half-dead rather than crashed; TiKV detects repeated disk stalls, scores them with fast escalation and slow recovery, and PD moves leaders away. The Raft path needs its append-complete boundary, and the KV probe needs its separate-disk boundary. Everything else is noise for this chapter.

Rebuilt 702 around that four-step chain. It now states the Raft inspection and KV-probe layout, the 100 ms / 30-tick / 10% / five-minute scoring defaults, the algorithm parameters, and PD's default score-80 leader eviction. Removed detailed worker paths, CPU and network behavior, diagrams, and a repeated conclusion; the concept map now defers those details.

## 2026-08-29 22:39 CST - Rebuild ROCKSDB 705 Around Value Separation

ROCKSDB 705 should receive the same pre-review standard as 702 through 704: derive Titan from a concrete LSM-tree cost, introduce its terms only when the reader needs them, and verify the actual TiKV boundary instead of polishing the old draft's assumptions. In particular, the chapter must not imply that an incoming write immediately places its value in a blob file, blur which column family uses Titan, or describe ratio-based GC as if it could delete individual records in place.

Rebuilt 705 from one large `default` CF value moving through flush and compaction. The chapter now preserves the WAL and memtable path, places key-value separation in SST construction, defines a BlobIndex through the read path, and explains why immutable blob files need ratio-based rewriting. It distinguishes transaction GC, RocksDB compaction, and Titan blob GC; records Titan's current new-cluster and column-family defaults without upgrade history; and updates the concept map with the corrected dependencies and deferred implementation details. The behavior was checked against the local TiKV configuration and its pinned Titan source.

## 2026-08-29 22:31 CST - Give ROCKSDB 704 One Coherent Pressure and Concurrency Model

ROCKSDB 704 should receive the same pre-review treatment as 702 and 703: build directly on the completed 605 model, define every new mechanism when it becomes necessary, and do not let a collection of implementation details become the chapter structure. The existing draft needed a clearer relationship between foreground writes and background storage pressure, could not rely on the transaction scheduler before 607 introduces it, and should not present CPU-derived compaction concurrency as a fixed default. Terms such as compatible writer, Bloom filter, and compaction picker also needed actual reader-level meanings.

Rebuilt 704 around the LSM tree under load. It now derives TiKV flow control from immutable-memtable, L0, and pending-compaction backlogs; distinguishes byte-rate delay from probabilistic busy rejection; and states the earlier control boundary relative to RocksDB write stalls. The chapter then follows concurrent `WriteBatch`es through WriteThread group commit, introduces point-read prefix seeking and Bloom filters from one MVCC key, and explains compaction file expansion, non-conflicting jobs, subcompactions, and Region-aware output cuts. Corrected `clean cut` to refer to one RocksDB key's internal sequence versions rather than TiKV MVCC versions, fixed the resource-derived concurrency wording, deferred scheduler internals to 607, and updated the concept map.

## 2026-08-29 22:23 CST - Rebuild RAFTSTORE 703 Around the Receiving Side

RAFTSTORE 703 should meet the same pre-review standard as the corrected 702: inherit the book's established flow, introduce one concrete storage problem, and avoid presenting a worker responsibility list as if that were an explanation. The previous draft repeated snapshot generation from 603, incorrectly assigned it to the Region worker in current TiKV, and mixed metadata overlap, snapshot application, delayed deletion, and deletion methods without first establishing how they are connected.

Rebuilt 703 around the receiving side of the snapshot path. It now distinguishes live Region metadata from stale physical data, follows range validation, cleanup, SST ingestion, and replication resumption in order, then derives delayed peer-data deletion from active RocksDB snapshots and sequence numbers. The file/key deletion strategies and the ordering between pending deletion and snapshot installation now serve that central flow. Snapshot generation is correctly assigned to its separate pool, while durable apply markers and split/merge lifecycle races remain deferred to 901; the concept map was updated to match.

## 2026-08-29 21:34 CST - Make RAFTSTORE 702 Read Like the Book

The first rewrite of RAFTSTORE 702 may have been source-checked, but it read like an implementation audit rather than a chapter from this book. The opening stacked heartbeat, KV-disk, range, and score facts before giving the reader a reason to care. You expected the writing to learn from completed chapters such as 501, 502, 606, and 607: connect naturally to an earlier idea, introduce one concrete problem, and let the mechanism emerge from that problem instead of presenting a catalog of verified details.

Rebuilt 702 around a single narrative inherited from RAFT 601: PD can move leaders, but it first needs to distinguish a store that is persistently slow from a brief latency spike. The chapter now proceeds through Raftstore inspection, score accumulation, the second KV-disk path, and leader eviction. Removed the opening scale diagram, reduced implementation narration, dropped the inspection ID, and shortened the chapter while retaining the source-verified timeout, CPU-busy, scoring, and recovery behavior. Added a durable skill rule that nearby completed chapters are style anchors and source verification must not dominate the prose.

## 2026-08-29 21:25 CST - Rebuild RAFTSTORE 702 from the Actual Slow-Score Boundary

RAFTSTORE 702 needs to withstand a detailed review, not merely turn old implementation notes into polished prose. The chapter should begin with the reader-facing problem of a store that is alive but persistently slow, then establish exactly what TiKV measures, how repeated observations become a score, and what PD does with that signal. It must follow the accumulated editorial rules: define every new component by its role, keep code names and parameter lists from taking over the explanation, and verify current behavior from local TiKV source so the text does not preserve stale assumptions about proposal latency, configuration, or busy apply.

Rewrote 702 around the separation between measurement, scoring, and cluster response. The chapter now traces the Raftstore inspection marker to the Raft write boundary, explains timeout and CPU-busy filtering, derives the 30-tick score update and asymmetric recovery with examples, distinguishes Raft-disk, KV-disk, and separate network scores, and connects a score of 100 to PD leader eviction. Removed the obsolete function tour, the inaccurate proposal-path diagram, and the unrelated busy-apply thresholds; updated the concept map with the corrected dependencies and deferred topics. The behavior was checked against the local TiKV and PD checkouts.

## 2026-08-29 21:10 CST - Use Dividers for Chapter-Level Returns

The horizontal divider in RAFTSTORE 701 makes an important structural boundary visible: a local mechanism, such as yielding, has ended, and the text is returning to the chapter-level model. That clarity should be applied across the book where it actually resolves this kind of ambiguity, but never turned into page decoration or a separator between ordinary sections.

Added dividers before whole-chapter takeaways or forward pointers in RAFT 401 and 402; ROCKSDB 403, 605, 704, 705, and 804; RAFT 602; RAFTSTORE 604 and 802; and TXN 607, 708, and 803. Left normal section transitions and chapters that already end on their complete flow unchanged. Added the durable divider-placement rule to the editing skill.

## 2026-08-29 21:08 CST - RAFTSTORE 701 Batch-System Review

RAFTSTORE 701 needs to make the two layers of batching visible rather than merely naming queues: many events for one Region collect in its mailbox, then an idle mailbox sends its FSM to a shared scheduler queue consumed by multiple pollers. Define a poller before using it and keep Rust ownership details out. Explain rounds through their reader-facing fairness rules: the configurable batch-size limit is `256` by default, every round admits at least one fresh FSM, and **rescheduling** moves roughly half of long-running hot FSMs after the default five-second threshold. The Raft path should name `step()` and the default 4,096-event per-peer turn. The apply path needs its own precise picture: one shared `WriteBatch` can write RocksDB multiple times in a turn, unlike one Raft Engine write I/O task per Raft batch round; yielding is checked for the current Region after those persistence points and trades fairness for a slower hot-backlog drain. Remove diagrams and summaries that only restate prose, and give the chapter a warm closing without pretending it introduces a new concept.

Rebuilt the queue diagram to show the two batching layers and multiple pollers. Reordered definitions, added the default batch, reschedule, and per-peer event limits, and connected message handling to `step()` and the proposal API. Rewrote the apply section around shared `WriteBatch` persistence, the 32 KiB / 500 ms yield conditions, repeated RocksDB writes, and the hot-Region tradeoff. Removed redundant diagrams and repeated conclusions, then separated the friendly final summary from the yield section with a divider. All TiKV behavior was checked against the local `/data/ssd1/tikv` checkout.

## 2026-08-29 20:08 CST - State the Batch-System Boundary Directly

The opening of RAFTSTORE 701 should say plainly that the two systems use batching to combine small, independent operations into fewer larger I/O operations. It also needs to explain the real tension: TiKV batches work across Regions while keeping each Region's events in order. “Workers share physical work” is too abstract to carry either idea.

Rewrote the two opening sentences around batching and the per-Region ordering boundary.

## 2026-08-29 20:02 CST - Pre-Review RAFTSTORE 701

Before formal review, RAFTSTORE 701 should be checked against the accumulated writing rules and the local TiKV implementation. Its reader-level point is the scheduling boundary: one Region remains ordered, while shared workers batch independent work across Regions. Code-method names, tuning defaults, and metrics must not take over that story. Verification should start from the local TiKV checkout rather than an upstream web source.

Reworked 701 around event routing, poller rounds, Raft `Ready` batching, and ApplyFsm yielding. Removed code-method names, incidental defaults, and the metrics/tuning section; clarified the kinds of events and the per-Region ordering boundary. Updated the concept map to defer implementation and diagnostic details, and added the local-source-first verification rule to the editing skill.

## 2026-08-29 19:36 CST - Keep TXN 607 on Its Core Flow

In TXN 607, the primary-key commit needs the acting subject: TiDB sends that commit. The scheduler-metrics section is not necessary at this level and interrupts the transaction-command story.

Changed the sentence to state that TiDB commits the primary key. Removed the scheduler-metrics section and marked those metrics as deferred in the chapter concept map.

## 2026-08-29 16:35 CST - Proactive Transaction Scheduler Review

After COP 606, the next review target is TXN 607. Today's feedback establishes a few checks that the draft needed: start from one concrete operation, make each section add information beyond earlier chapters, identify which component owns each operation, avoid incidental configuration detail, and do not let code-level diagnostic terms appear before their purpose is clear. The scheduler chapter also needs its actual execution order to be correct.

Rebuilt TXN 607 around one Region's prewrite for a two-Region transfer. It now introduces the scheduler before its mechanisms, puts latch acquisition before snapshot and MVCC reads, removes configuration values and duplicated lock-resolution prose, defines `CheckTxnStatus` and `ResolveLock` by their roles, and narrows the metrics section to actionable stage meanings. Added the reusable section-value, ownership-boundary, and introductory-detail rules to the editing skill.

## 2026-08-29 16:27 CST - Row Handles and Concrete Hash Join

COP 606 should explain a row handle through the actual distinction readers need: a clustered primary key uses the SQL primary key as the handle, while a nonclustered layout uses a hidden row ID. The configurability and default-setting discussion is a distraction here. The Index Join must not treat obtaining `user_id` as optional when the shown `status` index does not contain it. Hash Join needs build and probe as visible concepts, multiple join keys in the example, a reason to prefer a smaller build input, and a concise TiDB/TiKV boundary. It should also make clear that scanning and in-memory matching avoid the per-row inner lookup of Index Join.

Replaced the configuration paragraph with the two row-handle layouts and labelled the nonclustered primary-key index. Added another paid order and users so the examples show two join keys. Clarified the index-to-row read, bolded build/probe, expanded the Hash Join map, and reduced the execution-boundary text to TiDB hash matching, TiKV scans/filters, and the avoided repeated lookup.

## 2026-08-29 14:10 CST - Operators Need a Concrete DAG

COP 606's operator section did not add enough beyond COP 503. It named a filter and aggregate without explaining their work, then repeated the high-level cop task path. The chapter needs a more concrete, slightly richer DAG that gives the reader a feeling for how scan, filter, aggregation, and TopN cooperate and what TiKV returns to TiDB.

Replaced the repeated execution-path diagram with a grouped `SUM` query. It defines the four operators, shows Region-local filtering and partial aggregation below TiDB's final aggregation and TopN, and explains the bottom-up pull flow with a `user_id` partial-sum example.

## 2026-08-29 14:07 CST - Primary-Key Defaults and Hash Join Roles

In COP 606, the clustered-primary-key example left an essential question unanswered: whether it is the default layout, when TiDB uses a hidden internal row ID instead, and whether the choice is configurable. The Hash Join description also needed a concrete example and an explicit execution boundary: in the normal TiKV coprocessor path, TiKV provides planned scans and pushed-down filters, while TiDB performs hash-table matching.

Added the current configurable default and explicit DDL choices, named `_tidb_rowid` for the nonclustered layout, and retained a clustered example for the rest of the chapter. Added a `users` table and a build/probe Hash Join example for the existing SQL query, including the partial hash table and the TiDB/TiKV division of work.

## 2026-08-29 13:59 CST - Primary-Key Terms and SQL Readability

COP 606 should use paragraph boundaries to separate the recap, the chapter's purpose, and the SQL-to-KV contrast. `Clustered` and `nonclustered` primary keys cannot appear as unexplained labels: first show whether the SQL primary key itself is the TiKV row handle or whether a hidden handle is used with a primary-key index. Introductory join SQL should use full table names rather than unhelpful single-letter aliases.

Separated the opening into three connected paragraphs. Reordered the primary-key explanation around the two row-handle layouts before naming them clustered or nonclustered. Replaced aliases with `orders` and `users`, and added a skill rule to avoid aliases in introductory SQL examples.

## 2026-08-29 13:52 CST - Coprocessor Examples and Join Intuition

In COP 606, the first paragraph should connect the earlier coprocessor chapter to what this chapter will explain, without a separate abrupt sentence. Key examples need to account for omitted values and must not introduce an email absent from the table. An index scan being long does not imply it should be cheap, so the index-lookup cost needs direct wording. Seek and scan are their own access-shape idea, not a continuation of the optimizer paragraph. The join section needs to start with two tables and explain outer versus inner before describing index join and hash join.

Merged the opening into one bridge from COP 503. Made the `orders` schema self-contained with a unique `order_number` index and a labelled omitted non-unique index value. Reworded index lookup, separated seek/scan, and rebuilt join access patterns around outer/inner and build/probe mental models. Added a skill rule requiring self-contained examples and explicit omissions.

## 2026-08-29 13:41 CST - Informative Commit Messages

Commit messages should let a future reader understand the content of the change without opening the diff. They must name the kind of edit and affected chapters or area, rather than using broad messages that only say something was developed or refined.

Added a durable commit-message rule to the editing skill: the subject names the change and chapter/area, while multi-chapter or structural edits include a body listing their main scope.

## 2026-08-29 12:31 CST - Write Pressure Beyond Memtables

ROCKSDB 704 should not frame flow control as only a memtable issue. The opening needs a broader title and needs to connect immutable memtables, L0 backlog, and compaction backlog as pressure signals across one write path.

Renamed the section `Write Pressure and Flow Control`. It now introduces the three signals, their default thresholds, and the distinction between scheduler rate limiting for memtable/L0 pressure and progressive write rejection for pending compaction bytes.

## 2026-08-29 12:26 CST - Compaction Publication Without Internal Names

The previous compaction paragraph was close, but “old and new files do not mix” could be read too broadly: a current file set can contain new output alongside unrelated older SSTs. The accurate mechanism involves internal `Version` and `SuperVersion` objects, but those names should not appear without an introduction. The chapter should express only the reader-facing guarantee: a flush or compaction never exposes a partially installed file set, while old references delay deletion.

Replaced the paragraph with an atomic switch from compaction inputs to outputs, followed by a separate explanation that reads, iterators, and background work can retain old SST references. It now distinguishes eligibility for deletion from later physical deletion without introducing internal implementation types.

## 2026-08-29 12:23 CST - Core LSM Boundary

Before the final summary in ROCKSDB 605, you wanted a clear boundary that tells the reader the main mechanism is complete. The summary should feel like a consolidation of what was just learned, while later chapters carry the implementation and tuning details.

Added a short transition before the final mental model that closes the core LSM explanation and defers the remaining details.

## 2026-08-29 12:16 CST - LSM Movement and Dynamic Levels

For ROCKSDB 605, the flush path should show that an SST first enters L0 and compaction later creates SST files in deeper levels. An SST contains more than data blocks. L0 overlap comes from updates to the same keys, not vague overlapping ranges. Compaction needs to say that it both reorganizes files and moves data toward the bottom of the tree, while atomically publishing the new file set and retaining old SSTs for existing readers. The dynamic-level section should first explain why a small database skips mostly empty levels, then show L0 -> L6, later L0 -> L5 -> L6, and only then introduce the base-level term.

Expanded the write-path diagram through L0 and compaction, corrected the SST and L0 wording, added compaction publication and old-file lifetime, and rewrote dynamic level bytes around progressive level activation before defining the base level.

## 2026-08-29 12:00 CST - Coprocessor Key Layouts and Joins

For COP 606, the opening should not overstate a loose distinction between scans and seeks. You liked the concrete key introduction, but wanted it to show clustered and nonclustered primary-key layouts as well as unique and non-unique indexes. The chapter also needed to connect common SQL joins to their underlying KV reads. Its DAG section should explain how operators pull data from one another, not merely name a diagram. `Coprocessor Patterns` and `Coprocessor Execution` describe the two chapters better than `Operators` and `Performance`.

Removed the over-broad opening claim. Expanded the `orders` example with clustered/nonclustered and unique/non-unique layouts, added index-join and hash-join access patterns, and rewrote the DAG section as a pull chain. Renamed COP 606 and COP 707 throughout the book, map, and concept map.

## 2026-08-29 11:40 CST - Coprocessor Access Patterns

COP 606 began too abruptly and mixed three levels of detail. You wanted a gentle bridge from COP 503, then one illustrative table mapped all the way into TiKV row and index keys, including the readable `t`, `r`, and `i` shape. The core of this chapter should be concrete SQL patterns: a continuous table scan, an index scan, and an index lookup that turns an index scan into many row-key seeks. Pull-executor mechanics, yield behavior, timing, limits, and iterator metrics belong later in a dedicated performance chapter.

Rewrote COP 606 around the `orders` example, its conceptual TiKV keys, and the three access patterns. Added COP 707: Coprocessor Performance for the deferred runtime and metrics material. Moved Async Commit and 1PC to TXN 708, then updated navigation, links, and the chapter concept map.

## 2026-08-29 11:30 CST - Feedback Log Tone

The previous entries had become too compressed and lost too much of the original judgment behind the feedback. You wanted the log to remain simple, but to preserve enough of your tone and explanatory intent to be useful later. `Feedback` and `Changes` labels are unnecessary noise.

Rewrote the entries as plain paragraphs and updated the editing skill to require this format.

## 2026-08-29 11:26 CST - Feedback Log Format

You did not want the feedback log to become another rulebook or a file that must be read before every edit. It should be a simple, reverse-chronological record; chapter context belongs naturally in the text. Only lessons worth making permanent should go into the existing editing skill.

Changed the log ordering and workflow so entries are appended at the top, while durable rules are assessed and added only to the editing skill when warranted.

## 2026-08-29 11:20 CST - Persistent Editorial Feedback Record

You wanted each editorial interaction to leave a non-published record: after the book edit, capture what you were asking for and what actually changed. The record should help the writing process learn over time instead of repeatedly rediscovering the same preferences.

Added this internal feedback log and linked the append-and-assess workflow from the editing skill.

## 2026-08-29 11:15 CST - RocksDB Storage Flow Precision

For ROCKSDB 605, you wanted the mechanism to unfold more slowly and naturally: WAL comes before the memtable, the crash boundary must be exact, and an SST needs a concrete explanation of blocks, indexes, and lookup. `LSM levels` should not appear as a meaningless arrow in a write path. Memtable pressure is a TiKV flow-control topic, so it belongs in ROCKSDB 704 rather than interrupting the core LSM explanation.

Reworked 605 around WAL -> active memtable -> flush -> SST file, then introduced levels and compaction. Clarified the SST structure and deeper-level compaction selection. After checking the TiKV code, added `memtables-threshold` flow control to 704.

## 2026-08-29 10:58 CST - Ordered Level 7 Numbering

The Level 7 order looked arbitrary: RocksDB had 704 and 707 while COP and TXN filled the middle. You wanted the numbers to describe a natural reading sequence across the whole level, even though the level map still groups chapters by category.

Renumbered and relinked the pages as 704 RocksDB Details, 705 Titan, 706 YATP Internals, and 707 Async Commit and 1PC.

## 2026-08-29 10:55 CST - Specific Chapter Titles

`The LSM Tree` alone felt too abstract. You wanted the title of ROCKSDB 605 to say what concrete system the reader is learning about, not only name the general data structure.

Renamed it `ROCKSDB 605: RocksDB LSM Tree` in the page, navigation, map, and references without changing its numeric URL.

## 2026-08-29 10:02 CST - Core RocksDB Scope

ROCKSDB 605 had too many internal details before the reader had a basic picture. You wanted it to establish the essential LSM mechanism first, while prefix seeks, grouped writes, compaction guards, parallelism, and detailed file selection wait for a later chapter.

Rebuilt 605 around WAL, memtables, SST files, levels, compaction, and dynamic level sizing; added the later RocksDB details chapter and updated the map.

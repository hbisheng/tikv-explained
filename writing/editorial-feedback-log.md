# Editorial Feedback Log

This internal log records editorial feedback and the resulting changes. It is not mdBook content and must not be added to `src/`.

Entries are newest first. Each entry has two plain paragraphs: the user's distilled intent, then the resulting changes. Durable rules belong in `skills/tikv-explained-editing/SKILL.md`, not here.

## 2026-09-05 22:13 CST - Name the Book Around Its Learning Method

The title should describe the book's central promise without presenting mental models and mechanisms as two competing abstractions. `TiKV Explained: Mental Models from the Ground Up` captures both the goal of building understanding and the gradual, first-principles order reflected in the level map.

Updated the mdBook title, browser-title customization, README description, and license attribution to use the new title consistently.

## 2026-09-05 22:04 CST - Derive Snapshot Application from Stale Data in RAFTSTORE 703

The snapshot-application section should start from its actual storage problem: installing SST files does not by itself replace a Region's local contents. Range reservation prevents conflicting Region ownership but does not remove physical data left by a destroyed peer. The chapter should therefore derive the required order of overlapping cleanup and SST ingestion, use a concrete `{a, b}` versus `{a, c}` example, preserve the separate constraint imposed by existing readers, and defer the broader L0 pressure explanation to ROCKSDB 704.

Reworked the section around that chain. It now separates range admission from physical cleanup, lists the delete-before-ingest sequence, and explains both stale-key retention and delayed-deletion hazards. It retains the RocksDB snapshot constraint on whole-file deletion, states how normal writes are excluded while cleanup and ingestion are serialized, and links L0 ingestion delay directly to the flow-control section in ROCKSDB 704.

## 2026-09-05 21:41 CST - Center Merge Recovery on Durable Handoffs in RAFTSTORE 901

The merge section should connect the normal flow from RAFTSTORE 801 to lifecycle recovery without repeating the full protocol. It should explain what the source's `Merging` state preserves, why the target waits for the local source's apply work to stop, and why persisting the expanded target and source tombstone in one KV-engine batch is the durable transfer point. A leftover source should then decide whether to wait or destroy itself from the recorded merge target and its epoch, not from range overlap alone. For snapshot recovery, first distinguish snapshots from before and after the merge. Then distinguish the same target peer, which requires atomic source deletion and target recovery metadata, from a replacement peer that cannot replay the old target's `CommitMerge`. Finally, explain why B can absorb A and later merge into C without persisting the complete merge chain: every peer must first replicate and report the earlier merge committed, after which Raft apply order preserves the sequence.

Reworked the merge flow around those persistence boundaries. The source now records the target and required log interval while frozen; the target waits for local catch-up before atomically persisting both Region-state changes. The lagging-merge case now compares the local target with the recorded merge point: an unchanged target may still need the source, while a later split can advance the target's epoch and prove that the old merge path has moved on, permitting cleanup even without current range overlap. The snapshot race now uses Region version to identify a post-merge snapshot, explains the `atomic_snap_regions` batch for the same target peer, and shows why a larger replacement peer ID removes the risk of replaying the old `CommitMerge`. The merge-history section now uses A -> B -> C to connect proposal checks with Raft apply order, then closes the chapter by relating tombstones, atomic metadata batches, and in-memory guards to restart-safe lifecycle transitions.

## 2026-09-05 21:35 CST - Separate the Split Races in RAFTSTORE 901

The split-and-creation race should begin with a concrete parent and child: Peer 3 of R0 is still waiting for a pre-split snapshot when R0 creates R1 and Peer 1003. Peer 1003 can then be initialized through the parent's snapshot and split, or independently through a Raft message and its own snapshot. Creating an empty child first does not settle the race. The explanation must distinguish coordination between overlapping snapshots from coordination over which path may publish the child peer. The related split-and-deletion race should start from the same empty child and show how the shared lock prevents split from recreating a deleted peer or deletion from erasing a peer that split has just created.

Reworked the creation section around those two paths. `pending_snapshot_regions` now explains why the parent and child snapshots cannot install overlapping ranges together. `pending_create_peers` and the `StoreMeta` lock explain why split may replace the expected empty peer, while delayed message-based creation cannot overwrite an initialized child or a newer peer generation. The replaced peer's metadata check against `StoreMeta` now explains how its stale snapshot is rejected. Rebuilt the deletion race as two lock orderings: destruction persists its tombstone before split checks, or split claims replacement before destruction performs persistent cleanup. The split-first child is left to the earlier peer-GC mechanism.

## 2026-09-05 21:22 CST - Make Peer Split's Persistence Point Concrete in RAFTSTORE 901

The peer-split section should show what the Apply FSM writes for the existing Region and new Region, then make the KV-engine batch the explicit split persistence point. Its crash matrix should distinguish an uncommitted entry, a committed but unapplied entry, the atomic apply batch, and the gap before the Peer FSM handles the result. The exact initial index and term are implementation details that do not help explain this boundary and should be omitted.

Rebuilt the section around R0 becoming R0 and R1, listing both `RegionLocalState` records and both `RaftApplyState` updates in the atomic KV batch. Removed the fixed initial-state constants, their reconstruction details, and the corresponding crash-matrix case so the section remains focused on the durable topology change. Updated the concept map accordingly.

## 2026-09-05 20:36 CST - Use the Real Snapshot-Deletion Race Boundary in RAFTSTORE 901

The race between peer snapshot application and deletion should follow the simple logical architecture instead of expanding into `Ready` collection, polling, and message-batch details. The meaningful comparison is between the Peer FSM beginning peer destruction and beginning snapshot persistence. If destruction starts first, it wins. If snapshot persistence starts first, destruction normally waits, except when the Region-worker task is still in a cancelable window.

Reduced the section to the two serialized outcomes and kept task cancellation as a narrow exception to the snapshot-first path. It now makes the concurrency boundary explicit: after scheduling, the Region-worker task runs independently of the Peer FSM; cancellation can complete immediately before the task starts, but a running task must stop safely or finish before destruction. The correctness reason remains explicit: deletion cannot leave a tombstone while snapshot application can still overwrite `RegionLocalState` with `Normal`. Updated the reusable rule to require the true boundary at the highest useful abstraction, without unnecessary polling details.

## 2026-09-05 17:19 CST - Separate the Three Peer-Deletion Questions in RAFTSTORE 901

Peer deletion in RAFTSTORE 901 should answer three different questions in order instead of mixing them together: how a peer deletes itself after applying a configuration change, how an orphaned peer discovers removal when it never applies that entry, and exactly what tombstone information remains afterward. Orphan detection includes contacting replicas, receiving a message addressed to a newer peer generation, and checking with PD when ordinary Raft traffic can no longer settle the question. Losing the leader alone is not proof of removal; the peer may simply be waiting to reconnect. The final tombstone distinction matters: a peer that applied removal has the new epoch and excludes itself, a peer garbage-collected earlier retains old metadata including itself, and a never-initialized peer has only its own identity under a zero epoch.

Rebuilt the deletion section as `Configuration-Change Deletion`, `Orphaned Peer GC`, and `What Is Persisted After Deletion`. The normal path now states the tombstone persistence point and subsequent cleanup directly; the orphan path distinguishes evidence from normal Raft traffic from the authoritative PD fallback; and a table shows how epoch and peer-list contents differ across the three cases. The closing explanation connects those records to epoch checks and peer-ID generation checks for rejecting delayed messages.

## 2026-09-05 14:06 CST - Make RAFTSTORE 901's Persistence Boundaries Explicit

RAFTSTORE 901 should be named `Peer Lifecycle and Crash Recovery`, because crash recovery is the point of its durable-state discussion. Peer creation must say plainly that an uninitialized peer exists only in memory and vanishes on restart. Snapshot application must identify both the exact persistence point and the components around it: the Peer FSM obtains an accepted snapshot through Raft `Ready`, the store writer persists KV-engine state before Raft-engine state, and only then does the Peer FSM submit data application to the Region worker. Peer deletion needs the same treatment: distinguish the Apply FSM's durable tombstone write from the Peer FSM's later cleanup, explain what remains for initialized and uninitialized peers, and separate orphaned-peer cleanup from the normal removal path.

Renamed 901 throughout the book and rewrote its snapshot-application and deletion sections around their persistence boundaries. The snapshot path now follows `raft-rs`, `Ready`, the Peer FSM, store writer, and Region worker through both engine writes and both completion notifications. The deletion path identifies the tombstone as durable before later cleanup and explains how a retained peer ID rejects stale generations. Added a general editing rule requiring crash-recovery explanations to name their first durable write and recovery signal.

## 2026-09-05 12:03 CST - Organize RAFTSTORE 901 by Lifecycle and Race Boundaries

RAFTSTORE 901 should not mix peer creation, snapshot application, deletion, crash recovery, and cross-operation races under broad sections. Its structure should follow the lifecycle itself: peer creation, snapshot application and its durable handoff, deletion with peer garbage collection, and the creation/deletion race; then split, split crash recovery, split/creation race, and split/deletion race; then merge flow, merge/snapshot race, and merge history. Normal behavior must be established before the corner case that depends on it.

Reorganized 901 into those explicit boundaries without removing its concrete examples. Moved peer GC into deletion, separated snapshot application from creation, split the normal peer-split transition from its crash matrix and two races, restored the merge flow before its recovery cases, and renamed the final sections around merge/snapshot interaction and merge history. Updated the concept map and editing skill to preserve this normal-flow -> recovery -> race organization in later advanced chapters.

## 2026-09-02 11:11 CST - Keep the Preface Opening Natural and Move Brevity Into Scope

`Scope` gives the disclaimer a useful boundary, but `How to Read This Book` over-structures a short, naturally flowing introduction. The statement that this is not a long book is not reading guidance; it describes the book's deliberate content boundary and belongs beside the decision to cover core ideas rather than every part of TiKV.

Removed the unnecessary reading-method heading so the purpose, understanding-first approach, and Level Map flow directly. Moved the concise-length statement into `Scope` and separated the unofficial status, deliberate brevity, and work-in-progress status into three clear paragraphs.

## 2026-09-02 11:06 CST - Give the Preface Opening Clear Structural Boundaries

The opening Preface content is useful, but six loose paragraphs make its roles hard to distinguish. The book's purpose and motivation, the guidance for reading it, and the disclaimer about scope should not appear as one uninterrupted stream. In particular, the disclaimer needs a visible boundary so it reads as the book's scope rather than an afterthought.

Kept the opening wording unchanged and organized it into the initial purpose, `How to Read This Book`, and `Scope`. The existing FAQ remains a separate section, producing a clear purpose -> reading approach -> scope -> FAQ progression.

## 2026-09-02 11:04 CST - Make the Final FAQ Describe the Actual AI Writing Workflow

The final Preface FAQ should explain why end-to-end AI generation was not sufficient for this book rather than merely divide authorship credit. The central mismatch is explanatory judgment: generated text often does not feel natural or digestible and differs from how the author thinks the ideas should be presented. The recurring problems are concepts without proper introduction, implementation details without intuition, fixation on details that loses the big picture, and prose that is dull, repetitive, and unfocused. The actual workflow is iterative and hands-on: use an initial draft to refresh the concepts, then write the outline and sentence skeletons, ask an agent to fill in language, and edit sentence by sentence.

Replaced the entire answer to `Was this book AI-generated?` with the supplied account and kept its explanation centered on maximizing human understanding. Tightened the issue list to the four recurring failures above instead of splitting closely related problems into a longer catalog.

## 2026-09-02 11:02 CST - State the Preface's Deliberate Brevity

The Preface should tell readers early that this is intentionally not a long book: its text is minimized to remain digestible for humans. The direct-code-reading FAQ already says AI-assisted exploration can become fragmented and detail-oriented, so the additional example about understanding one function without seeing the whole system is unnecessary repetition.

Added the concise-length statement between the learning-path introduction and the Level Map link. Removed the repeated function-or-code-path sentence from the FAQ while keeping its larger point about fragmented code exploration.

## 2026-09-01 21:56 CST - Restore Semantic Markdown in the Preface

Replacing the Preface text must not silently discard useful Markdown semantics. The earlier emphasis on the book prioritizing understanding should remain visible, the Level Map is a real destination and should link to that page, and a literal example prompt should render as code rather than blend into the sentence. Similar reader-facing distinctions should be represented by the appropriate Markdown instead of plain text.

Restored the bold understanding statement, linked `Level Map` to its mdBook page, and marked the example AI prompt as inline code. Rebuilt the book and checked the generated HTML to confirm that all three render with the intended semantics.

## 2026-09-01 21:53 CST - Ground RAFTSTORE 901's Opening and Add-Peer Example

RAFTSTORE 901 should present its earlier chapters as an explicit prerequisite list rather than compressing five references into one sentence. In the add-peer example, every message must have a visible origin and destination: saying "the message" identifies an uninitialized peer is abstract when the reader has not been told exactly which event causes Store 4 to create it. The closing lifecycle rule is also too abstract; the example should state directly that a tombstone prevents a delayed Raft message from recreating a removed peer.

Replaced the opening reference paragraph with a three-item prerequisite section. Reworked the Peer 104 sequence around the first Raft message sent by the leader to Store 4, explained exactly what Store 4 knows and lacks after creating the uninitialized peer, and replaced the abstract lifecycle rule with the concrete delayed-message purpose of the tombstone.

## 2026-09-01 21:41 CST - Replace the Preface With a Reader-Facing Introduction and FAQ

The Preface should quickly give the reader a map: TiKV is large, code reading without the bigger picture is disorienting, and the levels provide a gradual path without requiring everything to be understood at once. It should clearly state that the book is the author's evolving view rather than official or exhaustive documentation. The discussion of human understanding, direct code reading, fragmented AI-assisted exploration, and the book's writing process belongs in a concise FAQ rather than a long uninterrupted reflection.

Replaced the previous Preface with the author's supplied version. Added only the Markdown hierarchy for the Preface, FAQ, and individual questions; preserved the supplied wording and organized it as the new reader-facing opening.

## 2026-08-31 21:23 CST - Restore the Concrete Lifecycle Insights in RAFTSTORE 901

RAFTSTORE 901 originally carried valuable examples and corner cases from code reading: an add-peer followed by removal, the split crash matrix, two different paths creating the same split child, split racing with destroy, stale-peer garbage collection, target snapshots racing with an unfinished merge, peer-generation changes, and the ordering behind consecutive merges. Reducing these to durable records and three guard names made the chapter cleaner but also ground away its distinct value. These examples are not redundant retellings of normal snapshot, split, and merge paths; they explain why the lifecycle state and guards exist.

Kept the clearer durable-record and cross-engine recovery structure, then restored the concrete Region 10 and Peer 104 example, snapshot/removal ordering, R10/R20 crash matrix, Peer 3 and Peer 1003 two-path race, split-versus-destroy outcomes, peer-GC triggers, same-generation and next-generation merge snapshot decisions, and consecutive-merge safety. Verified the mechanisms against the local TiKV source, expanded the 901 concept map, and added a durable editing rule that advanced author-derived corner cases must be organized rather than flattened away.

## 2026-08-31 14:36 CST - Give the Book a Criterion for Understanding TiKV

The preface should name a problem that becomes sharper in the AI world: answers to individual questions are easy to obtain, but understanding can become fragmented. It is easy to get attached to particular details without seeing the big picture, and hard to establish a criterion that says, "if I have figured these things out, I have grasped the essence of TiKV." This book is about building that sort of thing.

Added this idea directly after the distinction between checking coding details and building mental models. Kept the author's wording and direct tone while fixing the grammar and connecting the fragmented-answer problem to the book's purpose.

## 2026-08-30 23:17 CST - Make RAFTSTORE 901 Add Only Recovery Boundaries

RAFTSTORE 901 should build on the normal replica, snapshot, split, and merge paths already explained in 602 through 604, 703, and 801. Repeating those paths makes the chapter broad but not additive. Its distinct value is the durable state that survives a restart, the one cross-engine snapshot boundary, the in-memory guards that serialize overlapping transitions, and the narrow merge-recovery decision.

Replaced the normal-operation retelling with references to the earlier chapters. Rebuilt 901 around the three persistent peer records, startup behavior for each lifecycle state, `snapshot_raft_state_key`, three live-process guards, and `Merging` recovery by target epoch and peer ID. Updated the concept map to defer low-level cleanup and lock-order details instead of treating 901 as an exhaustive implementation reference.

## 2026-08-30 23:16 CST - Restore ROCKSDB 804 to the Release-8.5 Safe-Point Flow

ROCKSDB 804 describes release-8.5 and must not import the later master-only Transaction Safe Point API or turn it into a transaction-admission rule. The release-8.5 model has one GC safe point: GC lifetime proposes a candidate, active transactions and registered service safe points may hold it back, old locks are resolved, TiDB safe-point caches are refreshed, and only then is the value published to PD for TiKV's physical reclamation.

Removed the transaction-safe-point stage and its read-rejection diagram. Rebuilt the section around the release-8.5 candidate, its two limiting inputs, global lock resolution, TiDB cache refresh, and final PD publication. Updated the concept map and added a durable editing rule that a versioned chapter must be checked against that release rather than current master.

## 2026-08-30 22:00 CST - Rebuild RAFTSTORE 802 Around Hibernation Roles

RAFTSTORE 802 should establish one readable hibernation model rather than lead with a checklist of implementation conditions. A follower can stop its own ticks from local state because a living leader's heartbeat wakes it again; a leader needs stricter group-wide evidence because stopping it also stops regular heartbeats. The leader must obtain quorum agreement through a two-round poll, while skipped ticks deserve their own quick-election explanation. Multi-minute failure detection is acceptable for a traffic-free group because a request wakes it promptly, and the `Idle`, `PreChaos`, `Chaos`, and `Ordered` names need meanings before the state flow uses them.

Reduced the opening to idle-tick CPU cost and the chapter's three questions. Rebuilt the eligibility section around the follower/leader distinction, explicit leader poll and next-election-timeout confirmation, and scannable leader requirements; removed repeated and implementation-only checks. Moved skipped-tick replay into a standalone quick-election section, simplified wake-up text, defined the stale-check states before the diagram, and made the traffic-versus-slow-failure-detection tradeoff explicit.

## 2026-08-30 20:23 CST - Reduce RAFTSTORE 801 Source Preparation to the Handoff

The source-preparation section should show the reader the actual handoff path, not exhaust every validation branch. Start from source followers' matched indices, derive the logs that need preserving, then show `PrepareMerge` freezing writes. A vague "log boundary" obscures this flow, and a catalog of snapshots, configuration commands, and metadata checks distracts from it.

Rewrote the section around the lowest matched index and retained source logs. It now keeps only the representative retry conditions of a badly lagging peer or excessive retained history, then follows the `PrepareMerge` proposal and source write freeze. Updated the concept map to replace the abstract boundary with the matched-index handoff.

## 2026-08-30 20:12 CST - Give PD's Region-Merge Decision Its Thresholds

RAFTSTORE 801 should establish why PD starts a merge, not only what happens after it does. State the scheduler configuration that identifies a merge candidate and give its current defaults, but do not turn this implementation chapter into a broad scheduling-eligibility catalog.

Added PD's `max-merge-region-size` and `max-merge-region-keys` candidate rule before peer alignment: a Region must be at or below the default `54 MiB` and `540,000` approximate-key limits before PD considers merging it with an adjacent Region. Updated the concept map to begin the merge flow with PD finding that undersized Region.

## 2026-08-30 20:07 CST - Keep RAFTSTORE 801's Overview Concrete but Light

RAFTSTORE 801 should show its overall merge flow early without attempting to explain every command before the reader has the problem in mind. The overview must still say what each step means; bare labels in an arrow diagram do not establish a usable model. The source write freeze and two-command coordination are important enough to name, while their mechanisms belong in their later sections.

Moved the two-command list back into the introduction without its detailed explanation, moved the flow overview beside it, and replaced its poorly expressive arrow diagram with five concise action-and-purpose bullets. The source section now states that `PrepareMerge` makes the leader reject ordinary writes, and the retained-history diagram labels `PrepareMerge` without fragile whitespace alignment. Also expanded the RAFT 602 reference to its full title.

## 2026-08-30 19:02 CST - Let RAFTSTORE 802 Start With the Idle-Peer Problem

RAFTSTORE 802's opening should not compress the whole hibernation design into its first screen. Start gently from the recurring tick work of many idle peers and the purpose of pausing it. Eligibility checks, group agreement, wake-up behavior, skipped ticks, and leader-failure recovery each need to arrive only in the section that explains them.

Rebuilt the opening around the tick's basic purpose, the many-idle-peer CPU cost, and hibernation as a scheduling optimization that preserves Raft state. Removed the opening tick diagram and default configuration detail, then added a short chapter guide to the three later questions: when a group may sleep, how work wakes it, and how failure is detected.

## 2026-08-30 18:28 CST - Let TXN 708 Lead With the Commit Difference

TXN 708's opening should introduce the two ideas gently and positively before their mechanics: completed Async Commit prewrites let TiDB return, while 1PC applies when a transaction involves one Region. It should not begin by denying an imagined change to `write` CF, anticipate the concurrency-manager section, or use diagrams that merely reformat adjacent prose. In the 1PC section, the immediate contrast after Async Commit's locks is that successful 1PC writes no persistent transaction locks.

Replaced the negative opening with a two-path preview, removed the classic-2PC and Async-Commit flow diagrams, and deferred concurrency-manager context to its section. Reworded the Async Commit summary around completed prewrites and the 1PC summary around its one-Region condition. Reordered the 1PC section so the no-persistent-lock contrast follows the Async Commit lock statement directly, then explains the one-batch condition and direct committed-record write.

## 2026-08-30 18:15 CST - Keep TXN 708 at Its Protocol Boundaries

TXN 708 needs accurate protocol roles where they affect the reader's main model, but should not turn into an audit of value encodings, recovery bookkeeping, or scheduler guards. Recovery must distinguish a missing lock with no commit record from a committed key, 1PC needs separate client-attempt and TiKV-fallback boundaries, and Async Commit must not be described as choosing its final timestamp inside TiKV.

Replaced the per-key value claim with persisted lock and required value data, limited the primary's secondary list to recovery, and made a missing lock without a commit record a rollback outcome. Clarified that TiDB attempts 1PC only for one prewrite batch, TiKV can still produce ordinary 2PC locks, and TiDB then continues with 2PC. The concurrency-manager setup now distinguishes Async Commit's TiDB-selected final timestamp from 1PC's TiKV-selected timestamp. Updated the concept map and limited the closing claim to committed write transactions.

## 2026-08-30 17:08 CST - Make COP 707's Boundaries Concrete

COP 707 must state the actual scanner cadence and threshold rather than leave "periodically" and "too long" undefined. The long-task limiter also needs its real trigger, but resource-control admission should disappear because the book has not introduced resource control. Its timing section should be a short explanation of the relevant boundaries, not a second metrics reference.

Specified the first-key-after-new-range check, 32-key checkpoints, and the non-strict 1 ms scanner time slice. Replaced admission material with the unary-handler rule: after more than 5 ms of accumulated active poll time, a still-pending handler needs a semaphore permit before another poll. Reduced timing text to schedule wait, snapshot wait, process time, and suspension; removed the YATP panel catalog and duplicated flow diagram. Updated the concept map accordingly.

## 2026-08-30 16:53 CST - Keep COP 707 to Its Execution Boundaries

COP 707 was repeating the cop request path already established in COP 503 and 606, then adding implementation-level scan counters that did not advance the chapter's purpose. Its value is narrower: show where a cop task yields, which controls can make it wait, and how TiKV separates those waits from execution time. Snapshot acquisition belongs only as the meaning of the snapshot-wait boundary, not as another end-to-end request-flow section.

Removed `From Request to Execution`, its repeated flow diagram, the streaming detour, and all TiKV/RocksDB scan-statistics material. Rebuilt the opening around the distinct waiting and execution boundaries, retained the range-scanner yield mechanism and admission/concurrency controls, and made the tracker and YATP timing signals the chapter's core. Updated COP 606's forward link and the concept map to match.

## 2026-08-30 16:40 CST - Explain the Human Work Behind the Book

The preface should be candid about why this book remains a human writing project even when coding agents can quickly inspect implementation details. The important human work is building the big picture and accurate mental models. Agents still tend to produce technical prose with broken logical flow, unintroduced concepts, assumed knowledge, distracting statements about what something is not, expressions that are neither natural nor clear at a glance, and long recaps that add no useful information. The book should introduce ideas gradually, with every chapter adding something new; repeatedly commanding an agent to delete redundant text or manually rewriting it sentence by sentence should not be part of the normal workflow. An agent writing everything also leaves no independent review or accuracy audit. This book is instead a curated summary reviewed by a TiKV developer, which does not make it error-free but gives its claims a higher accuracy bar than an unaudited draft. Less is more: the book should contain the core ideas rather than exhaustive details, leave further lookup to the code, and remain a developing piece that can gain new material over time. More fundamentally, agents do not seem to judge what is difficult for a human mind, what carries the essence, and what a book does not need to say. A book that maximizes understanding is therefore hard to write with unsupervised agents, and its value is no longer to duplicate the code as a technical reference but to convey the author's own understanding of TiKV. This passage should retain the author's own wording and tone; polishing it into generic editorial prose kills part of its point.

Kept the original preface and expanded the section after its human-reader statement. It distinguishes code lookup from model building, describes the limitations observed in generated technical writing, calls out redundant chapters that fail to add information, and states the less-is-more boundary between core ideas and code-level detail. It records the actual outline-fill-manual-rewrite-verify workflow, adds the accuracy value of a TiKV-developer-curated summary over an unaudited draft, and frames the book as a developing expression of the author's way of understanding and seeing TiKV. Reworked the passage using the author's original vocabulary and sentence posture, limiting changes to grammar and coherence. It ends with the hope that future agents will make systematic learning in unfamiliar fields much faster.

## 2026-08-30 16:23 CST - Explain Multi-Level Queue Before Its Policy

The multi-level queue section in COP 706 should not jump to task demotion without first explaining the three levels and what differentiates them. Establish their scheduling shares, then show how normal tasks move between them, how fixed priorities bypass that movement, and the response-time benefit and long-task tradeoff.

Rebuilt the section around level 0 through 2, their scheduling role, the default accumulated-running-time thresholds, and YATP's level-0 target share. It now explains that YATP classifies incoming work by execution time already accumulated under its task identifier, distinguishes queue selection from a time slice, gives TiKV's fixed-level mapping for high, low, and background work, and ends with the short-read versus long-task tradeoff. Updated the concept map to name the three-level feedback queue.

## 2026-08-30 16:02 CST - COP 706 Future Explanation Economy

COP 706 should introduce Rust Futures to readers outside Rust without repeatedly restating the same idea. Once `poll()` and its `Ready`/`Pending` results establish the model, state preservation and wakers explain the next step. The task-state section must also clearly distinguish a Future's poll result from YATP's separately recorded scheduling state: `NOTIFIED` means ready to poll, not that the Future returned `Ready`.

Reordered the Future explanation around `poll()`, its results, saved progress, and event-driven waking. Rebuilt the state-machine section around the two layers of state and their transitions, with only the wake-up-during-poll case needed to show why notifications are not lost. Removed repeated Future/task definitions, the duplicate state summary, redundant cooperative-scheduling wording, and the final recap while preserving the scheduling choices and forward link.

## 2026-08-30 13:20 CST - Lead COP 706 With the Future Task

COP 706 should establish a cop task's actual representation and execution model before introducing worker threads. Start from the Future that wraps request work and state, explain how an executor gives it turns through `poll()`, then introduce YATP workers as the implementation that runs ready Futures. The Future section should not use a worker concept before it is defined.

Reordered the opening around a Future task and its executor. The polling and waker explanation now comes first and refers only to the executor; the worker section follows with the YATP queue and the limited worker threads that call `poll()`. Updated the concept map so its core flow begins with creating the Future task.

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

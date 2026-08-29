# Editorial Feedback Log

This internal log records editorial feedback and the resulting changes. It is not mdBook content and must not be added to `src/`.

Entries are newest first. Each entry has two plain paragraphs: the user's distilled intent, then the resulting changes. Durable rules belong in `skills/tikv-explained-editing/SKILL.md`, not here.

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

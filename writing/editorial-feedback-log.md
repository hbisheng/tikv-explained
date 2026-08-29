# Editorial Feedback Log

This internal log records editorial feedback and the resulting changes. It is not mdBook content and must not be added to `src/`.

Entries are newest first. Each entry has two plain paragraphs: the user's distilled intent, then the resulting changes. Durable rules belong in `skills/tikv-explained-editing/SKILL.md`, not here.

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

# Level Map

This book is organized by understandability, not by source-code directory.

Each level should give the reader a complete view at that height. A reader can stop after a level and still leave with something real.

## Level 1: First View

What TiKV is, why it exists, and what problem it solves.

## Level 2: System Shape

The major components: TiDB, TiKV, PD, Regions, replicas, leaders, followers, and scheduling.

## Level 3: Request Flow

How reads and writes enter the system and move through the major layers.

## Level 4: Core Ideas

Raft, RocksDB, MVCC, snapshot isolation, and basic transaction flow.

## Level 5: Practical Mechanisms

Raftstore, apply flow, snapshots, coprocessor, compaction, and more detailed transaction behavior.

## Level 6+

Real TiKV mechanisms: batching, peer lifecycle, split, merge, hibernate regions, flow control, resource control, and failure recovery.

The mountain metaphor belongs here: the book is a climb, but the title should stay approachable.


# TiKV 402: The Raft Event Loop

TiKV uses [`raft-rs`](https://github.com/tikv/raft-rs) to implement the Raft protocol. `raft-rs` is a Rust implementation of Raft modeled after the Go Raft library used by etcd.

The library maintains the internal Raft state of each peer and exposes a small set of APIs that TiKV uses to drive it.

The three most important APIs are `step`, `ready`, and `advance`.

## `step`: Feed an Event into Raft

TiKV uses `step` to pass an incoming Raft message to a peer. The message might be an AppendEntries, a vote response, or another message from a remote peer.

A new command from the application follows the same general idea, although it normally enters `raft-rs` through a proposal API rather than directly through `step`.

When `raft-rs` receives an event, it updates the peer's in-memory Raft state and decides what should happen next. It does not perform the resulting disk or network operations itself.

## `ready`: Ask Raft What Needs to Be Done

TiKV calls `ready` to retrieve the work that `raft-rs` has produced.

A `Ready` value may contain three main kinds of work:

- Raft messages that should be sent to other peers.
- Raft state and log entries that should be persisted.
- Committed log entries that should be applied to the state machine.

`raft-rs` decides that this work is necessary, but TiKV is responsible for actually performing it.

## `advance`: Report That the Work Is Complete

After TiKV finishes processing a `Ready`, it calls `advance`.

This tells `raft-rs` that the previous batch of work has been completed. The peer can then continue processing events and produce more work.

The basic loop is therefore:

```text
feed an event into raft-rs
ask for the pending work
perform that work
report that the work is complete
repeat
```

## A Concrete Example

Suppose a follower receives an AppendEntries message from its leader.

TiKV passes the message to the follower's `raft-rs` peer through `step`. `raft-rs` checks the message and updates its in-memory state.

At this point, however, no log entry has been written to disk and no response has been sent over the network.

TiKV then calls `ready`. The returned `Ready` may contain:

```text
persist:
    a new Raft log entry

send:
    a response to the leader
```

TiKV performs those operations and then calls `advance` to report that the `Ready` has been processed. After that, it continues with the next event, if there is one.

## The Peer FSM

In TiKV's Raftstore, each Region peer is driven by a component called a `PeerFsm`.

The name describes its role well: it is a finite-state machine that repeatedly receives events, drives the corresponding `raft-rs` peer, and processes the work returned through `Ready`.

The core event loop of a Raft peer is:

```text
Receive an event.
Let raft-rs make a decision.
Perform the resulting work.
Continue.
```

With this picture, we have described the core process of a single-Region Raftstore: it receives an event, drives the Region's `raft-rs` peer, performs the work returned through `Ready`, and continues. This is the execution loop behind the Raftstore layer introduced in [TiKV 301: TiKV Architecture](../tikv-301/index.md).

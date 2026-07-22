# TiKV 403: RocksDB as a Local KV Store

RocksDB is an open-source, embedded key-value storage library. TiKV uses it as a local, single-node KV store.

A write stores a value under a key. Writing the same key again logically replaces its previous value:

```text
put("name", "Alice")
put("name", "Bob")

get("name") -> "Bob"
```

## Versions

Internally, RocksDB keeps versions of a key rather than immediately overwriting the old value. Each write receives an increasing number called a **sequence number**.

Conceptually:

```text
"name" at sequence 10 -> "Alice"
"name" at sequence 20 -> "Bob"
```

## Snapshots

A RocksDB snapshot is associated with a sequence number. It represents a consistent view of the KV store at that point in time.

For example:

```text
write "name" = "Alice"
take snapshot S
write "name" = "Bob"
```

A normal read now returns `"Bob"`, while a read through snapshot `S` still returns `"Alice"`.

Old versions must remain available as long as an active snapshot may still need them. The oldest active snapshot therefore helps determine which versions can eventually be physically removed.

## Reading

TiKV can read from a snapshot in two main ways:

- A point lookup retrieves one key.
- A range scan calls `seek` to find a starting position, then repeatedly calls `next` to move forward.

We will discuss how RocksDB stores and searches for these keys when we introduce its LSM-tree structure.

## Column Families

A RocksDB database can contain multiple column families. For now, think of them as physically separated key-value spaces inside the same database.

TiKV commonly uses:

- `default` for values.
- `write` for transactional MVCC records.
- `lock` for transaction locks.

RocksDB is a local, versioned KV store. Writes create versions, snapshots provide consistent views of those versions, and column families separate different kinds of data.

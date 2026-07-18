# The Shape Of A TiKV Cluster

At Level 2, the goal is to see the main objects before understanding their internal mechanisms.

```text
SQL client
    |
    v
  TiDB  ---- asks routing/time/scheduling questions ---->  PD
    |
    v
  TiKV cluster
    |
    +-- Store 1: Region replicas
    +-- Store 2: Region replicas
    +-- Store 3: Region replicas
```

TiDB receives SQL requests and turns them into key-value operations. TiKV stores the key-value data. PD keeps cluster-level metadata and scheduling decisions.

TiKV divides the keyspace into ranges called Regions. A Region is the basic unit of replication and movement.

```text
keyspace:

|------ Region 1 ------|------ Region 2 ------|------ Region 3 ------|
```

Each Region has multiple replicas. One replica is the leader. The leader handles normal reads and writes for that Region. Followers replicate from the leader.

```text
Region 10

Store 1: Peer 101  leader
Store 2: Peer 102  follower
Store 3: Peer 103  follower
```

At this level, do not worry yet about how Raft elects a leader or commits a log entry. The important point is the shape:

```text
Region = key range
Peer   = one replica of a Region
Leader = the Peer currently serving that Region
PD     = the component that tracks and schedules the cluster
```

## What Should Remain

TiKV is a cluster of stores. The keyspace is split into Regions. Each Region has replicated Peers, and one Peer acts as leader.


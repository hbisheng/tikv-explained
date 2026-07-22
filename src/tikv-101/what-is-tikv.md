# TiKV 101: What Is TiKV?

[TiKV](https://tikv.org/) is the **storage layer** of TiDB, a distributed SQL database.

A database stores and manages data. Almost every online service, from shopping websites to banking systems, depends on databases to keep track of information.

A **distributed database** spreads data across multiple machines so the system can grow beyond a single machine, handle higher traffic, and keep working through machine failures.

TiDB is one such distributed database. TiKV is the storage layer inside TiDB: the component responsible for storing and retrieving data.

At its core, TiKV is a highly scalable, low-latency **key-value store**. A key-value store organizes data as pairs: given a key, the system stores or retrieves the corresponding value.

```text
key                 value
-----------------   -----
user:42:name        Alice
user:42:city        Shanghai
order:9001:status   paid
```

Real TiKV is much more complex than this, but this **key-value model** is the first mental model to keep in mind.

**Low latency** means TiKV is designed to serve reads and writes quickly. Another important part of TiKV is **transaction support**: when one logical operation touches multiple pieces of data, those changes must be applied correctly together.

These properties are essential for **OLTP (Online Transaction Processing)** workloads, which power user-facing applications such as creating an order, updating an account balance, or changing a user profile. These operations are usually small, but they require both **low latency** and **strong correctness**.

This combination is what makes TiKV interesting. It is not just a place to store data. It is a distributed system designed to remain fast and reliable as data grows, traffic increases, and failures become inevitable.

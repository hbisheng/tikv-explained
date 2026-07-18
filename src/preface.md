# Preface

This book is my way of explaining TiKV.

TiKV is not only a codebase. It is a collection of mechanisms: range partitioning, replication, scheduling, transactions, storage engines, batching, recovery, and many careful choices around failure.

The goal of this book is not to list every implementation detail. The goal is to build the mental models that make the details readable.

The intended reader is someone who wants to understand TiKV gradually:

- first as a distributed key-value system,
- then as a set of interacting components,
- then as concrete mechanisms,
- and eventually as code-level behavior.

Many chapters will use diagrams and Rust-shaped pseudocode. Real code appears only when it helps the reader find the implementation or understand a mechanism precisely.

This book is allowed to grow in public. A chapter marked as draft is still part of the map.


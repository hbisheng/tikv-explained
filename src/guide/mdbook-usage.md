# How To Use mdBook

This page is a practical cheat sheet for writing this book.

## Local Commands

Build the book:

```sh
mdbook build
```

Preview locally:

```sh
mdbook serve --open
```

Check links and generated HTML by building before commit:

```sh
mdbook build
```

The generated output is in `book/`. Do not edit files under `book/`; edit files under `src/`.

## Add A Chapter

Create a Markdown file under `src/`, then add it to `src/SUMMARY.md`.

Example:

```md
# Level 4: Core Ideas

- [Raft: The Basic Idea](levels/level-4/raft-basic-idea.md)
```

mdBook uses `SUMMARY.md` as the sidebar and chapter order.

## Cross-Page Links

Use normal Markdown links to `.md` files:

```md
[Level Map](../level-map.md)
```

mdBook converts the link to the generated `.html` page.

Use heading anchors for sections:

```md
[What should remain](../level-map.md#level-1-first-view)
```

For important headings, define a stable anchor so future title edits do not break links:

```md
## Region Routing { #region-routing }
```

Then link to it:

```md
[Region routing](../levels/level-3/region-routing.md#region-routing)
```

## Pseudocode

Use `text` for language-neutral pseudocode:

````md
```text
for each region:
    send heartbeat to PD
    report approximate size and leader status
```
````

Use `rust,ignore,noplayground` for Rust-shaped pseudocode that should not compile or show a playground button:

````md
```rust,ignore,noplayground
fn apply_entry(entry: RaftEntry) {
    persist_to_kv_engine(entry.mutations);
    update_applied_index(entry.index);
}
```
````

Use real Rust blocks only when the example is intended to compile:

````md
```rust
let region_id = 10;
assert_eq!(region_id + 1, 11);
```
````

## Diagrams

For quick diagrams, use `text` blocks. They are stable, reviewable, and work without plugins:

````md
```text
TiDB
  |
  v
TiKV leader ---- replicate ----> TiKV follower
```
````

For richer diagrams, store image files under `src/assets/diagrams/` and link them:

```md
![Raft write flow](../assets/diagrams/raft-write-flow.png)
```

Mermaid can be added later with a plugin or custom renderer. Until then, prefer ASCII diagrams or checked-in image files.

## Callouts

Plain Markdown blockquotes are enough for most notes:

```md
> Note: A Region is a key range. A Peer is one replica of that Region.
```

Use a clear label:

```md
> Draft status: this chapter has the right structure but still needs examples.
```

## Tables

Tables are useful for state transitions:

```md
| State | Meaning | Recovery behavior |
|---|---|---|
| Normal | Peer is active | Recreate in memory |
| Applying | Snapshot apply started | Resume snapshot apply |
| Tombstone | Peer was removed | Prevent old messages from recreating it |
```

## Include Real Files Later

mdBook can include snippets from files. This is useful when examples should come from tested source files.

The syntax is shown with spaces here to avoid activating it inside this guide:

```md
{ {#include examples/raft.rs} }
```

When using it for real, remove the spaces. The exact syntax is:

```text
{ {#include examples/raft.rs} }
```

## References

Prefer references at the end of the chapter:

```md
## References

- [TiKV source code](https://github.com/tikv/tikv)
- [Raft paper](https://raft.github.io/raft.pdf)
```

This keeps the main explanation readable.

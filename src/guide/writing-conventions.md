# Writing Conventions

Each chapter should be written for a specific reader level.

Before writing the body, decide:

- what the reader already knows,
- what should remain after reading,
- which concepts must appear,
- and which order minimizes confusion.

## Chapter Shape

Use this structure by default:

```text
1. Framing
2. Main explanation
3. Diagram or pseudocode
4. Recap
5. References, if needed
```

Do not put too much motivation before the reader knows what object is being discussed.

## Concept Rule

When a concept first appears, define it near the first use.

Bad:

```text
The scheduler moves leaders to improve load balance.
```

Better:

```text
PD can move a Region leader from one TiKV store to another. This operation is called leader scheduling.
```

## Draft Rule

Unfinished chapters are allowed, but mark the state clearly:

```md
> Draft status: structure is stable; examples are still missing.
```

or:

```md
> Draft status: raw notes; not ready for readers yet.
```

This makes it safe to grow the book incrementally without pretending every page is finished.


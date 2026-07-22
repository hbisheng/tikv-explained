---
name: tikv-explained-editing
description: Editing rules for /home/bishengh/tikv-explained. Use when Codex edits the TiKV Explained book, mdBook config, SUMMARY.md, repo AI rules, title/positioning, or converts TiKV Mountain notes into chapters. Keep chapters sparse, direct, level-ordered, and validated with mdbook build.
---

# TiKV Explained Editing

## Boundaries

- Follow `AGENTS.md`.
- Keep `src/` reader-facing. Put guides, AI notes, and process docs outside the book.
- Do not commit generated `book/`.
- Keep the repo private and do not push unless the user explicitly asks.

## Writing

- Follow the 101 style: cut to the chase, direct, succinct.
- Show only what is necessary for the reader's current level.
- Explain in logical order, one step at a time.
- Do not introduce unfamiliar terms before they are needed; define important terms near first use.
- Keep the flow natural. Use short sections when a concept needs its own mental boundary.
- Avoid unnecessary summaries, meta narration, and obvious setup sentences.
- Defer protocol roles and mechanism details until the level that needs them.
- Avoid turning TiKV-specific design into general database claims.
- Prefer small diagrams, concrete examples, and Rust-shaped pseudocode over long prose.
- Use bold sparingly for core concepts that help scanning.
- Preserve the author's explanatory intent; avoid generic polished filler.
- Mental model first, mechanism next, code details last.

## Structure

- `src/SUMMARY.md` controls sidebar order.
- Add chapters only when the user wants them visible.
- Keep the initial book sparse.

## Validation

- Run `mdbook build` after changes to `src/`, `book.toml`, `SUMMARY.md`, theme, or mdBook config.
- If editing this skill, run:

```sh
python3 /home/bishengh/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/tikv-explained-editing
```

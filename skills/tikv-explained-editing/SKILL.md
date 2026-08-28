---
name: tikv-explained-editing
description: Editing rules for /home/bishengh/tikv-explained. Use when Codex edits the TiKV Explained book, mdBook config, SUMMARY.md, repo AI rules, title/positioning, or converts TiKV Mountain notes into chapters. Keep chapters sparse, direct, level-ordered, and validated with mdbook build.
---

# TiKV Explained Editing

## Boundaries

- Follow `AGENTS.md`.
- Keep `src/` reader-facing. Put guides, AI notes, and process docs outside the book.
- Before drafting or substantially revising a chapter, consult and update `writing/chapter-concept-map.md`. For every chapter, record its dependencies, concepts introduced, core flow, and deferred details.
- Do not commit generated `book/`.
- Keep the repo private and do not push unless the user explicitly asks.

## Writing

- Follow the 101 style: cut to the chase, direct, succinct.
- Start from the problem and first principles. Explain why before how, introduce concepts one at a time, and do not assume knowledge not established in earlier chapters.
- Show only what is necessary for the reader's current level.
- Explain in logical order, one step at a time.
- Do not introduce unfamiliar terms before they are needed; define important terms near first use.
- A new chapter may rely only on concepts established by earlier chapters, unless it defines the concept where it first appears. Audit every nontrivial term, acronym, and code-level name before publishing: it must be established earlier, defined locally, or removed/deferred. Do not use code-level names as unexplained shorthand.
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

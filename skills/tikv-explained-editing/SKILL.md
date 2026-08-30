---
name: tikv-explained-editing
description: Editing rules for /home/bishengh/tikv-explained. Use when Codex edits the TiKV Explained book, mdBook config, SUMMARY.md, repo AI rules, title/positioning, or converts TiKV Mountain notes into chapters. Keep chapters sparse, direct, level-ordered, and validated with mdbook build.
---

# TiKV Explained Editing

## Boundaries

- Follow `AGENTS.md`.
- Keep `src/` reader-facing. Put guides, AI notes, and process docs outside the book.
- When verifying TiKV mechanics for book text, use the local checkout at `/data/ssd1/tikv` first. Use upstream web sources only as a fallback or cross-check.
- When a chapter describes a specific release, verify cross-component behavior against that release rather than current `master`; do not mix later APIs into the earlier-release narrative.
- Treat agent-generated technical prose as unreviewed until its claims have been checked against the implementation and the chapter has been curated as a whole.
- Before drafting or substantially revising a chapter, consult and update `writing/chapter-concept-map.md`. For every chapter, record its dependencies, concepts introduced, core flow, and deferred details.
- Do not commit generated `book/`.
- Keep the repo private and do not push unless the user explicitly asks.
- Use specific commit messages. The subject must state the kind of change and the affected chapter or area; for multi-chapter or structural changes, add a commit body that lists the main chapters/files and the substantive change. Avoid generic messages such as `Develop`, `Update`, or `Refine` without that context.

## Writing

- Batch feedback-log entries by a coherent revision or material editorial lesson. Do not add an entry for every small wording correction; fold related small feedback into the next relevant entry. Do not treat batching as permission to omit or indefinitely defer a substantial feedback session: after a coherent review or revision series, add one consolidated entry before moving on. When an entry is warranted, append it before committing in reverse-chronological order. Use two plain paragraphs: preserve the user's core intent and tone, with affected chapters embedded; then state the changes made. Do not copy the full conversation or use `Feedback` / `Changes` labels.
- When adding an entry, decide whether its feedback establishes a durable rule. Add only durable rules to this skill; do not record rules in the feedback log.
- Follow the 101 style: cut to the chase, direct, succinct.
- Start from the problem and first principles. Explain why before how, introduce concepts one at a time, and do not assume knowledge not established in earlier chapters.
- Less is more. Keep the core ideas necessary for the reader's current mental model; leave exhaustive details to the code or later chapters. The book can grow as new material becomes worth adding.
- Explain in logical order, one step at a time.
- Do not introduce unfamiliar terms before they are needed; define important terms near first use.
- A new chapter may rely only on concepts established by earlier chapters, unless it defines the concept where it first appears. Audit every nontrivial term, acronym, and code-level name before publishing: it must be established earlier, defined locally, or removed/deferred. Do not use code-level names as unexplained shorthand.
- Keep the flow natural and make each idea clear at a glance. Use short sections when a concept needs its own mental boundary.
- Use `---` only to separate a completed local mechanism from a chapter-level takeaway or forward pointer. Do not use it as decoration or between ordinary sections.
- Make every section and chapter add a distinct step, decision, or boundary. Keep recaps only when they establish the problem for new material; do not repeat earlier content without moving the reader's understanding forward.
- In a multi-component flow, name which component performs each action. Distinguish a logical operation or plan from the physical access path that implements it.
- When explaining a protocol optimization, state what correctness evidence replaces the removed step. Distinguish the point where the logical outcome becomes final from later cleanup or materialization work.
- Leave configurable defaults, version history, and tuning values out of introductory explanations unless they change the mental model being built.
- Avoid unnecessary summaries, meta narration, and obvious setup sentences.
- Defer protocol roles and mechanism details until the level that needs them.
- Avoid turning TiKV-specific design into general database claims.
- Prefer small diagrams, concrete examples, and Rust-shaped pseudocode over long prose.
- Keep illustrative schemas and key examples self-contained: do not introduce a field or index value absent from the example, and explicitly label intentionally omitted key or value data.
- In introductory SQL examples, prefer full descriptive table and column names over aliases. Introduce aliases only when the alias syntax itself matters.
- Use bold sparingly for core concepts that help scanning.
- When the author provides wording or a logical outline, preserve their vocabulary, tone, and directness as much as possible. Fix coherence and grammar; do not replace their voice with generic polished prose.
- Preserve the author's explanatory intent; avoid generic polished filler.
- Use strong completed chapters nearby as style anchors. Source verification should make the prose accurate, but it must not turn a chapter into an implementation audit or a list of verified facts.
- When explaining metrics, verify the exact instrumentation boundaries. A dashboard label is not a definition: distinguish wall time from active execution, one poll from a whole task, and a gauge from throughput.
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

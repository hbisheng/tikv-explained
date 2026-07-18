---
name: tikv-explained-editing
description: Editing workflow and guardrails for the TiKV Explained mdBook repository. Use when Codex edits /home/bishengh/tikv-explained, changes book source, changes mdBook configuration, adds chapters, converts TiKV Mountain notes into book content, edits title/positioning, or updates project-only AI rules. Keep the book sparse, keep guides out of src/, preserve level-based cognitive order, prefer diagrams and Rust-shaped pseudocode over code dumps, and validate with mdbook build.
---

# TiKV Explained Editing

## Core Rule

Edit the book as a gradual explanation, not as a generated documentation dump.

The current repository is intentionally sparse. Do not add broad scaffolding, guide chapters, placeholder sections, or large draft content unless the user asks for them.

## Repository Boundaries

- Treat `src/` as reader-facing mdBook content only.
- Do not put AI instructions, author workflow notes, guide material, skill files, or process docs under `src/`.
- Put AI/project rules outside the book, such as `AGENTS.md` or `skills/`.
- Do not commit generated `book/` output.
- Keep the repo private unless the user explicitly asks to make it public or publish GitHub Pages.

## Book Structure

- Keep `src/SUMMARY.md` as the source of the sidebar and reading order.
- Add a chapter to `SUMMARY.md` only when the user wants that chapter to appear in the book.
- Prefer a small number of real pages over many empty placeholders.
- Keep `Preface` and `Level Map` as the initial public surface until the user asks to add more book content.

## Writing Workflow

Before substantial book-content edits, decide:

1. What reader level the chapter is for.
2. What the reader already knows.
3. What should remain in the reader's mind after reading.
4. Which concepts must appear, and in what order.

For tiny wording fixes, apply this check mentally and keep the diff small.

## Writing Style

- Explain mental models before mechanisms.
- Explain mechanisms before code-level details.
- Introduce concepts gradually; define important terms near first use.
- Prefer diagrams and concise examples over long prose.
- Use Rust-shaped pseudocode when it clarifies a mechanism.
- Use `rust,ignore,noplayground` for illustrative Rust-like pseudocode.
- Use real TiKV function names only when they help the reader find the implementation.
- Avoid making the book sound harder than necessary.
- Avoid over-polishing raw ideas into generic AI prose; preserve the author's explanatory intent.

## mdBook Rules

- Use normal Markdown links to `.md` files for cross-page references.
- Use stable heading anchors for important links when a heading may change.
- Run `mdbook build` after changes to `src/`, `book.toml`, workflows, or mdBook-related files.
- If editing this skill, run:

```sh
python3 /home/bishengh/.codex/skills/.system/skill-creator/scripts/quick_validate.py skills/tikv-explained-editing
```

## Change Discipline

- Keep edits minimal and directly tied to the user's request.
- Do not recreate previously removed guide material inside the book.
- Do not import large chunks from `knowledge-base/the-tikv-mountain` without reshaping them for reader level and cognitive order.
- Do not change the title, repo name, license, privacy, or publishing model unless the user asks.
- After edits, show what changed, what was validated, and any remaining risk.


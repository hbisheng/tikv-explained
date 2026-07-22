# Repository Agent Instructions

- Before making AI-assisted edits in this repository, read and follow `skills/tikv-explained-editing/SKILL.md`.
- `src/` is only for reader-facing mdBook content. Do not put guide material, AI workflow notes, skill files, or process docs under `src/`.
- Keep the initial book sparse. Do not add chapters, placeholders, or large generated content unless the user asks.
- Keep the repository private unless the user explicitly asks to publish it or make it public.
- Default Git workflow: create a new local commit when appropriate. Do not amend existing commits unless the user explicitly asks. Do not push to any remote unless the user explicitly asks to push.
- Run `mdbook build` after changes that affect the book or mdBook configuration.
- Do not commit generated `book/` output.

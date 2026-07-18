# Publishing Later

This repository starts private so the book can grow without launch pressure.

When the first public slice is ready, the likely path is:

1. Make the repository public.
2. Enable GitHub Pages.
3. Add a deploy workflow that builds mdBook and publishes `book/`.

The current workflow only validates that `mdbook build` succeeds. That is enough while the repository is private.

## Public Readiness Bar

A reasonable first public slice is:

- Preface.
- Level map.
- One Level 1 chapter.
- One Level 2 chapter.
- One deeper chapter that demonstrates the eventual depth.
- Clear draft labels on unfinished pages.

Do not wait for every level to be complete before publishing.


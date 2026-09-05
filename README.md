# TiKV Explained

Mental models for understanding TiKV from the ground up.

This repository contains the source for the book **TiKV Explained: Mental Models from the Ground Up**. It is built with [mdBook](https://rust-lang.github.io/mdBook/).

## Local Workflow

Build the static book:

```sh
mdbook build
```

Preview while writing:

```sh
mdbook serve --open
```

The source lives in `src/`. The generated static site is written to `book/` and is intentionally ignored by Git.

## License

Unless stated otherwise:

- Prose and diagrams are licensed under CC BY 4.0.
- Code snippets and pseudocode are licensed under Apache-2.0.

See `LICENSE.md` for details.

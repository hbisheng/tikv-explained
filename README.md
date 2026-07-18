# TiKV Explained

Mental models and mechanisms for understanding TiKV.

This repository contains the source for the book **TiKV Explained: Mental Models and Mechanisms**. It is built with [mdBook](https://rust-lang.github.io/mdBook/).

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

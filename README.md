# TiKV Explained

Mental models and mechanisms for understanding TiKV.

This repository contains the source for the book **TiKV Explained: Mental Models and Mechanisms**. It is built with [mdBook](https://rust-lang.github.io/mdBook/).

## Local Workflow

Install mdBook:

```sh
cargo install mdbook --version 0.4.52 --locked
```

Build the static book:

```sh
mdbook build
```

Preview while writing:

```sh
mdbook serve --open
```

The source lives in `src/`. The generated static site is written to `book/` and is intentionally ignored by Git.

## Writing Shape

The book should be readable from the first level, while still leaving room for code-level mechanisms later.

- Use mental models before details.
- Use diagrams and pseudocode when they explain better than real code.
- Use real function names only when they help the reader look up the implementation.
- Keep draft chapters visible, but clearly labeled.

## License

Unless stated otherwise:

- Prose and diagrams are licensed under CC BY 4.0.
- Code snippets and pseudocode are licensed under Apache-2.0.

See `LICENSE.md` for details.


# Agent Instructions

Ship (`@atom-forge/ship`) is a small, dependency-free release CLI (`ship-it`) for Node.js 22+ and Bun. It prepares one npm package release locally — preflight checks, version bump, changelog stamp, commit, tag, atomic push — and leaves the publish to a tag-triggered CI job. Other AtomForge packages use it for their releases, so its behavior and CLI are a public API.

How to use the package is described in `README-AI.md` (not written yet; until then, `README.md`). Read it before changing the CLI's behavior or its documentation.

Documentation model: **book-first**.

## Rules

Read the rule file that applies before you start, not only at the end:

- **Changing code, tests, or configuration** → read `AGENTS/devrules.md` first: this package's development rules, source layout, and commands.
- **Changing the book, `docs/`, `README.md`, or `README-AI.md`** — including any change to the public API or its behavior, which always needs documentation → read `AGENTS/documentation.md` first.
- **Every task** ends with a `CHANGELOG.md` entry → follow `AGENTS/changelog.md`.

`AGENTS/changelog.md` and `AGENTS/documentation.md` are shared by every AtomForge package and are identical in all of their repositories: change them only when the change is meant for every package, and then in all AtomForge package repositories at once. Everything else in `AGENTS/` — `devrules.md` and the files it refers to — belongs to this package alone.

## Todos and notes

- `TODO.md` lists planned work, most important first, one or two lines per item. Longer context lives in `notes/`, and the item links to it.
- `notes/` holds ideas, plans, specs, and research in any form and language.
- Neither is an instruction: work on an item only when asked. When you finish one, remove it from `TODO.md` (the changelog records the change) and update or delete the notes it made obsolete. When you notice work outside the current task, add it to `TODO.md` and mention it in your report.
- Neither is shipped in the npm package.

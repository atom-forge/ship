# Changelog

## [Unreleased]

### Added
- `TODO.md` for planned work and a `notes/` folder for ideas, plans, and specs, with rules in `AGENTS.md`: neither is an instruction, finished items leave `TODO.md`, and neither is shipped.
- BookMD learning guide in `book/` covering configuration, the release flow, setup, CI and troubleshooting.
- Interactive `ship-it init` wizard for local release configuration, CI generation, first npm publish and Trusted Publisher setup, with confirmations and resumable progress.
- Tag-triggered GitHub Actions publishing with OIDC authentication and Node/Bun validation.

### Changed
- Agent instructions follow the AtomForge structure: `AGENTS.md` holds a short project description, a pointer to `README-AI.md`, the documentation model, and when to read which rule file. `AGENTS/devrules.md` holds this package's own development rules, source layout, and commands; `AGENTS/changelog.md` and `AGENTS/documentation.md` are shared and identical in every AtomForge package (`documentation.md` covers the book-first and reference-first documentation models, BookMD authoring with a link to the canonical BookMD LLM reference, the upgrading chapter, and `README-AI.md` versus AI Notes).
- `.DS_Store` files are ignored by Git.
- `README.md` links the published book and points Ship development to `AGENTS.md`.

## [0.1.0] - 2026-09-28

### Added
- Runtime-portable release CLI with Git preflight, atomic push, changelog stamping and exact npm version checks.

### Changed
- Name the CLI command `ship-it`; retain `@atom-forge/ship` as the package name.

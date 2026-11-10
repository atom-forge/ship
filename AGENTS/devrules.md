# Development rules

Development rules of this package. Unlike `AGENTS/changelog.md` and `AGENTS/documentation.md`, this file is not shared with other AtomForge packages.

## General

- Keep changes focused and consistent with the existing code style. Edit the sources, never generated output.
- Preserve the public API and its behavior unless a breaking change is explicitly requested. A change that may require action from users is breaking: follow `AGENTS/changelog.md` and the *Upgrading chapter* rules in `AGENTS/documentation.md`.
- A change to the public API or its behavior is also a documentation change: update the documentation in the same task, following `AGENTS/documentation.md`.
- Before finishing, run the checks listed below and report what passed or failed.
- Only commit, push, or publish when asked.

## Project

- Plain JavaScript (ES modules), no build step and no runtime dependencies. `bin/ship-it.js` is the CLI entry; `src/ship.js` is the library facade, and `src/` is split by responsibility (`cli`, `release`, `project`, `version`, `changelog`, `git`, `registry`, `files`, `verify`, `init`, `init-plan`, `workflow`, `prompts`, `errors`).
- Tests in `test/` use disposable local Git repositories and an in-process registry fixture; they never publish or push to external remotes. Run them under both runtimes: `node --test` and `bun test`. CI runs `.github/workflows/test.yml`.
- Release (with Ship itself): `npm run pub -- <patch|minor|major>` · Verify: `npm run pub-check`

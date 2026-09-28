# Changelog

## [Unreleased]

### Added
- Interactive `ship-it init` wizard for local release configuration, CI generation, first npm publish and Trusted Publisher setup, with confirmations and resumable progress.
- Tag-triggered GitHub Actions publishing with OIDC authentication and Node/Bun validation.

## [0.1.0] - 2026-09-28

### Added
- Runtime-portable release CLI with Git preflight, atomic push, changelog stamping and exact npm version checks.

### Changed
- Name the CLI command `ship-it`; retain `@atom-forge/ship` as the package name.

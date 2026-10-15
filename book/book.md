---
title: Ship
subtitle: "@atom-forge/ship"
author: AtomForge
language: en
id: atom-forge-ship
intro: A practical guide to releasing one npm package with ship-it, from an Unreleased changelog entry to a CI-triggering Git tag.
tags: [release, npm, cli]
children:
  - "[[01-overview.md]]"
  - "[[02-configuration-and-commands.md]]"
  - "[[03-release-flow.md]]"
  - "[[04-setup-and-ci.md]]"
  - "[[05-recipes-and-troubleshooting.md]]"
  - "[AI Notes](ai-notes.md)"
---
# Releasing with Ship

`@atom-forge/ship` is a dependency-free release CLI for Node.js 22+ and Bun. Its command is `ship-it`. It prepares one npm-style package release **locally** — checks, version bump, changelog stamp, commit, tag, atomic push — and leaves the actual `npm publish` to a tag-triggered CI job.

This book explains the mental model, the commands and configuration, what each phase of a release does, how to connect CI and npm Trusted Publishing, and what to do when something fails.

> [!abstract] What you will learn
> What Ship does and does not do, how to configure `package.json.ship`, how a release moves through three phases, how the setup wizard and CI workflow fit together, and how to recover from a failed tag or push.

## Reading path

1. [[01-overview|Overview]] — scope, responsibilities, and installation.
2. [[02-configuration-and-commands|Configuration and commands]] — `ship` settings and every `ship-it` command.
3. [[03-release-flow|Release flow]] — preflight, verification and commit, tag and push, plus recovery.
4. [[04-setup-and-ci|Setup and CI]] — the `init` wizard, the publish workflow, and Trusted Publishing.
5. [[05-recipes-and-troubleshooting|Recipes and troubleshooting]] — daily routines and common errors.

> [!note] Examples
> Snippets assume a package named `@acme/widget` in a GitHub repository, with `npm` as the package manager, unless stated otherwise. Version numbers are illustrative.

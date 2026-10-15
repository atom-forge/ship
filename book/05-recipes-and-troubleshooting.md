---
type: chapter
requires: [ship-config, release-flow, setup-and-ci]
---
# Recipes and troubleshooting

## A routine release

1. Make sure the work is committed and merged to the release branch, and that your notes are under `## [Unreleased]`.
2. Preview the plan:

   ```sh
   npm run pub -- minor --dry-run
   ```

3. Release:

   ```sh
   npm run pub -- minor
   ```

4. Wait for CI, then confirm the version is live:

   ```sh
   npm run pub-check -- --wait 120
   ```

## Writing the Unreleased section

Use [Keep a Changelog](https://keepachangelog.com/) categories (`Added`, `Changed`, `Fixed`, ...). Ship requires only that the section is not empty. Record user-facing changes as you make them, so a release never starts with an empty section.

## Verification commands

Mix any tooling; they run in order from the repository root:

```json
{
  "ship": {
    "verify": ["npm run check", "npm test", "npm run build"]
  }
}
```

Keep them deterministic and free of side effects on tracked files. Ship checks that the tree is still clean after they finish.

## A non-default branch or remote

```json
{
  "ship": {
    "branch": "release",
    "remote": "upstream",
    "tagPrefix": "release-"
  }
}
```

Change the workflow's tag pattern together with `tagPrefix`; the wizard does this for you.

## Troubleshooting

| Message or symptom | Cause | Fix |
|---|---|---|
| `Working tree and index must be clean, including untracked files.` | Uncommitted or untracked files | Commit, stash or ignore them |
| `Release must run on main.` | Wrong branch | Switch branch or set `ship.branch` |
| `Local HEAD must match the remote release branch.` | Unpushed or behind | Push or pull first |
| `Tag already exists: v1.5.0` | Tag exists locally or on the remote | Delete the stray tag or pick a different version |
| `<name>@<version> is already published.` | The registry has that version | Choose a higher version |
| `The Unreleased section is empty.` | Nothing under `## [Unreleased]` | Add release notes |
| `Changelog must contain exactly one ## [Unreleased] heading.` | Missing or duplicate heading | Repair the changelog |
| `Verification failed: <command>` | A `ship.verify` command failed | Fix it and run again |
| `Unknown ship setting: <key>` | Typo in `package.json.ship` | Use only documented settings |
| `Tag and package.json version must match exactly.` | `validate` ran on the wrong tag | Check `--tag` or `GITHUB_REF_NAME` |
| `Not published: <name>@<version>` | CI still running or publish failed | Use `--wait`, then inspect the CI run |
| `Release commit preserved. Inspect local/remote tag ...` | Tag or push failed after the commit | Finish manually; do not bump again |

> [!warning] Ship cannot see CI
> A successful `ship-it` run only means that the tag was pushed. Publishing succeeds only if the workflow runs and npm trusts it, so always confirm with `ship-it check`.

> [!note] Source of truth
> The README in the repository describes the current behavior, and the source is authoritative. Re-check this book whenever commands or settings change.

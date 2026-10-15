---
type: chapter
requires: [ship-scope]
teaches: [ship-config, ship-commands]
---
# Configuration and commands

## Minimal configuration

```json
{
  "scripts": {
    "pub": "ship-it",
    "pub-check": "ship-it check"
  },
  "ship": {
    "verify": ["npm test", "npm run build"]
  }
}
```

The `ship` object is optional, but you should always set `verify`: Ship does not assume that any test or build script exists.

> [!warning] Only configure trusted commands
> `verify` commands run in the repository root through the system shell. Treat them like any other script in your project.

## Settings

| Field | Default | Purpose |
|---|---|---|
| `verify` | `[]` | Ordered shell commands; any failure blocks the release |
| `branch` | `main` | Branch the release must run on |
| `remote` | `origin` | Git remote used for branch and tag checks and for the push |
| `tagPrefix` | `v` | Prefix of the release tag (`v1.2.3`) |
| `changelog` | `CHANGELOG.md` | Tracked changelog file inside the project |
| `registry` | `https://registry.npmjs.org` | Public npm-compatible metadata endpoint |

Rules enforced when the configuration loads:

- Unknown `ship` settings are rejected, so typos fail loudly.
- `package.json` needs a `name` and a stable `x.y.z` `version`.
- Private packages (`"private": true`) cannot be released.
- `branch`, `remote`, `tagPrefix`, `changelog` and `registry` must be non-empty strings that do not start with `-`.
- The changelog must be a separate file inside the project, not `package.json` or a lockfile.
- The registry must use HTTPS (`localhost` and `127.0.0.1` are allowed for tests).

## Commands

```sh
ship-it                    # same as: ship-it patch
ship-it minor
ship-it major
ship-it 2.0.0              # explicit stable version
ship-it minor --dry-run    # print the plan only
ship-it check              # is this version on the registry?
ship-it check --wait 120   # retry for up to 120 seconds
ship-it validate --tag v1.2.3
ship-it init               # interactive setup wizard
ship-it init --dry-run     # read-only setup suggestion
ship-it --help
```

### Release commands

`patch`, `minor`, `major` or an explicit `x.y.z` compute the target version from the current one. Explicit versions must be stable and **strictly greater** than the current version.

```text
current 1.4.2  +  patch  ->  1.4.3
current 1.4.2  +  minor  ->  1.5.0
current 1.4.2  +  major  ->  2.0.0
current 1.4.2  +  1.4.2  ->  error: the release version must increase
```

### --dry-run

A dry run performs the read-only preflight checks and prints the plan as JSON: package, old and new version, tag, branch, verify commands, the files that would change, and `"push": "atomic"`. It runs no verification commands and changes nothing. It still needs network access to the remote and the registry.

### check

`check` asks the registry for the **exact** `name@version` in `package.json`, independent of the `latest` dist-tag. With `--wait seconds` (0–3600) it retries a missing version every few seconds until the deadline. Network, authentication and server errors fail immediately.

### validate

`validate` makes no changes. It confirms that the tag equals `tagPrefix` + `package.json` version and that the changelog has a `## [x.y.z] - date` entry. The tag comes from `--tag`, then `GITHUB_REF_NAME`, then an exact local tag.

> [!note] Use Bun explicitly if you want it
> The executable runs on Node by default. To run it with Bun, invoke `bun ./node_modules/@atom-forge/ship/bin/ship-it.js`.

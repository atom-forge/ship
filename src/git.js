/**
 * Narrow Git adapter used by the release orchestration.
 *
 * The adapter centralizes command execution and the repository invariants
 * that make a release safe: clean state, the configured branch at its remote
 * HEAD, an unused tag, and one atomic push of that branch plus that tag.
 */
import { execFileSync } from 'node:child_process';
import { fail } from './errors.js';

export function git(...args) {
  return execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
}

export function ensureClean() {
  if (git('status', '--porcelain')) fail('Working tree and index must be clean, including untracked files.');
}

export function ensureReleaseBranch(config) {
  if (git('branch', '--show-current') !== config.branch) fail(`Release must run on ${config.branch}.`);
  const remoteHead = git('ls-remote', '--exit-code', config.remote, `refs/heads/${config.branch}`).split(/\s/)[0];
  if (remoteHead !== git('rev-parse', 'HEAD')) fail('Local HEAD must match the remote release branch.');
}

export function ensureUnusedTag(config, tag) {
  git('check-ref-format', `refs/tags/${tag}`);
  if (git('tag', '--list', tag) || git('ls-remote', '--tags', config.remote, `refs/tags/${tag}`)) fail(`Tag already exists: ${tag}`);
}

export function pushRelease(config, tag) {
  git('push', '--atomic', config.remote, `HEAD:refs/heads/${config.branch}`, `refs/tags/${tag}:refs/tags/${tag}`);
}

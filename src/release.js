/**
 * Release use-case orchestration.
 *
 * This module coordinates preflight checks, configured verification commands,
 * changelog/manifest updates, commit/tag creation and the final atomic push.
 * It also owns the non-mutating `check` and `validate` use cases. The actual
 * Git, filesystem and registry operations are delegated to small adapters.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { setTimeout } from 'node:timers/promises';
import { hasReleaseEntry, stampChangelog } from './changelog.js';
import { fail } from './errors.js';
import { restore, snapshot, writeFile, writeVersionedJSON } from './files.js';
import { ensureClean, ensureReleaseBranch, ensureUnusedTag, git, pushRelease } from './git.js';
import { releaseFiles } from './project.js';
import { isPublished } from './registry.js';
import { nextVersion } from './version.js';
import { verify } from './verify.js';

export function validate(pkg, config, tag) {
  if (!tag || tag !== `${config.tagPrefix}${pkg.version}`) fail('Tag and package.json version must match exactly.');
  if (!hasReleaseEntry(readFileSync(config.changelog, 'utf8'), pkg.version)) fail('Missing release changelog entry.');
  console.log(`Validated ${pkg.name}@${pkg.version}`);
}

export async function check(pkg, config, seconds) {
  const deadline = Date.now() + seconds * 1000;
  do {
    if (await isPublished(pkg, config, pkg.version)) {
      console.log(`Published: ${pkg.name}@${pkg.version}`);
      return;
    }
    if (Date.now() >= deadline) break;
    await setTimeout(Math.min(3000, deadline - Date.now()));
  } while (true);
  fail(`Not published: ${pkg.name}@${pkg.version}`);
}

export async function release(pkg, config, bump, dryRun) {
  if (resolve(git('rev-parse', '--show-toplevel')) !== process.cwd()) fail('Run ship from the Git repository root.');
  ensureClean();
  ensureReleaseBranch(config);
  const version = nextVersion(pkg.version, bump);
  const tag = `${config.tagPrefix}${version}`;
  ensureUnusedTag(config, tag);
  if (await isPublished(pkg, config, version)) fail(`${pkg.name}@${version} is already published.`);
  const files = releaseFiles(config);
  for (const file of files) git('ls-files', '--error-unmatch', '--', file);
  const original = snapshot(files);
  const changelog = stampChangelog(original.get(config.changelog), version);
  if (dryRun) {
    console.log(JSON.stringify({ package: pkg.name, from: pkg.version, version, tag, branch: config.branch, verify: config.verify, files, push: 'atomic' }, null, 2));
    return;
  }
  verify(config.verify);
  ensureClean();
  let committed = false;
  try {
    for (const [file, content] of original) {
      if (file === config.changelog) writeFile(file, changelog);
      else writeVersionedJSON(file, content, version);
    }
    git('add', '--', ...files);
    git('commit', '-m', `release ${tag}`);
    committed = true;
    git('tag', tag);
    pushRelease(config, tag);
    console.log(`Released ${tag}; CI can now publish ${pkg.name}@${version}.`);
  } catch (error) {
    if (!committed) {
      restore(original);
      git('reset', '--', ...files);
      throw error;
    }
    fail(`Release commit preserved. Inspect local/remote tag ${tag} before retrying; do not bump again. ${error.message}`);
  }
}

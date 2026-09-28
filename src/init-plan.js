/**
 * Local planning helpers for the Ship setup wizard.
 *
 * Planning is separate from applying changes or invoking npm/Git. It suggests
 * existing project scripts, normalizes GitHub URLs, and prepares a manifest and
 * changelog without deleting the project's legacy files or custom settings.
 */
import {existsSync, readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fail} from './errors.js';
import {managers} from './workflow.js';

export function githubRepository(url) {
  const match = String(url).match(/^(?:git\+)?(?:https:\/\/github\.com\/|git:\/\/github\.com\/|git@github\.com:|ssh:\/\/git@github\.com\/)([\w.-]+\/[\w.-]+?)(?:\.git)?\/?$/);
  return match?.[1] ?? null;
}

export function suggestManager(pkg, cwd) {
  const declared = pkg.packageManager?.split('@')[0];
  if (managers.includes(declared)) return declared;
  if (existsSync(join(cwd, 'bun.lock')) || existsSync(join(cwd, 'bun.lockb'))) return 'bun';
  if (existsSync(join(cwd, 'pnpm-lock.yaml'))) return 'pnpm';
  if (existsSync(join(cwd, 'yarn.lock'))) return 'yarn';
  return 'npm';
}

export function suggestedVerify(pkg, manager) {
  if (pkg.ship?.verify?.length) return [...pkg.ship.verify];
  const scripts = pkg.scripts ?? {};
  const names = ['check', 'test', scripts.prepack ? 'prepack' : 'build'];
  return names.filter(name => scripts[name] && !/^(?:pub|pub-check|pub-validate)$/.test(name)).map(name => `${manager} run ${name}`);
}

export function lockedInstall(manager, cwd) {
  if (manager === 'npm') {
    if (!existsSync(join(cwd, 'package-lock.json')) && !existsSync(join(cwd, 'npm-shrinkwrap.json'))) fail('Commit an npm lockfile first: npm install --package-lock-only --ignore-scripts');
    return 'npm ci';
  }
  const lockfiles = manager === 'bun' ? ['bun.lock', 'bun.lockb'] : manager === 'pnpm' ? ['pnpm-lock.yaml'] : ['yarn.lock'];
  if (!lockfiles.some(file => existsSync(join(cwd, file)))) fail(`Create and commit the ${manager} lockfile before initializing CI.`);
  if (manager === 'yarn') return 'yarn install --frozen-lockfile';
  return `${manager} install --frozen-lockfile`;
}

export function initializedManifest(pkg, {repository, branch, remote, verify}) {
  const next = structuredClone(pkg);
  const self = pkg.name === '@atom-forge/ship' && pkg.bin?.['ship-it'] === 'bin/ship-it.js';
  const command = self ? 'node bin/ship-it.js' : 'ship-it';
  next.repository = {...(typeof pkg.repository === 'object' ? pkg.repository : {}), type: 'git', url: `git+https://github.com/${repository}.git`};
  next.scripts = {...pkg.scripts, pub: command, 'pub-check': `${command} check`, 'pub-validate': `${command} validate`};
  next.ship = {...pkg.ship, verify};
  if (branch !== 'main' || pkg.ship?.branch) next.ship.branch = branch;
  if (remote !== 'origin' || pkg.ship?.remote) next.ship.remote = remote;
  next.publishConfig = {...pkg.publishConfig, access: 'public', registry: 'https://registry.npmjs.org'};
  if (Array.isArray(next.files) && !next.files.includes(pkg.ship?.changelog ?? 'CHANGELOG.md')) next.files.push(pkg.ship?.changelog ?? 'CHANGELOG.md');
  return next;
}

export function setupChangelog(content) {
  const note = '- Configure releases with Ship.\n';
  const heading = /^## \[Unreleased\][ \t]*\r?$/m;
  if (!content) return `# Changelog\n\n## [Unreleased]\n\n### Added\n${note}`;
  const count = [...content.matchAll(/^## \[Unreleased\][ \t]*\r?$/gm)].length;
  if (count > 1) fail('Changelog contains multiple Unreleased sections; repair it first.');
  if (count === 0) {
    const title = content.match(/^# .*\r?\n/);
    if (title) return content.replace(title[0], `${title[0]}\n## [Unreleased]\n\n### Changed\n${note}\n`);
    return `## [Unreleased]\n\n### Changed\n${note}\n${content}`;
  }
  const start = content.search(heading);
  const unreleased = content.slice(start).split(/^## /m).slice(1, 2).join('');
  if (unreleased.includes(note.trim())) return content;
  const changedHeading = unreleased.match(/^### Changed[ \t]*\r?$/m);
  if (changedHeading) {
    const section = content.slice(start);
    return content.slice(0, start) + section.replace(changedHeading[0], `### Changed\n${note}`);
  }
  return content.replace(heading, `## [Unreleased]\n\n### Changed\n${note}`);
}

export function jsonText(content, value) {
  const indent = content.match(/\n([\t ]+)"/)?.[1] ?? '  ';
  return JSON.stringify(value, null, indent) + '\n';
}

export function readOptional(path) {
  return existsSync(path) ? readFileSync(path, 'utf8') : '';
}

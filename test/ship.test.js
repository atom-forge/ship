/**
 * End-to-end safety tests for Atom Ship.
 *
 * The suite combines pure helper checks with disposable Git repositories and
 * a local HTTP registry fixture. It verifies release preflight, atomic push,
 * metadata restoration and exact-version publication checks without touching
 * external repositories or registries.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawn } from 'node:child_process';
import { createServer } from 'node:http';
import { nextVersion, stampChangelog } from '../src/ship.js';

const cli = fileURLToPath(new URL('../bin/atom-ship.js', import.meta.url));

test('stable version increments and rejected regressions', () => {
  assert.equal(nextVersion('1.2.3', 'patch'), '1.2.4');
  assert.equal(nextVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(nextVersion('1.2.3', 'major'), '2.0.0');
  assert.equal(nextVersion('1.2.3', '2.3.4'), '2.3.4');
  for (const value of ['1.2.3', '1.2.2', '0.9.9', '01.2.4', '1.2.4-beta.1', 'patch; exit']) assert.throws(() => nextVersion('1.2.3', value));
});

test('changelog stamping preserves notes and rejects empty/duplicate releases', () => {
  const source = '# Changelog\n\n## [Unreleased]\n\n### Fixed\n- A bug\n\n## [1.0.0] - 2026-01-01\n- Initial\n';
  const result = stampChangelog(source, '1.0.1', '2026-09-27');
  assert.match(result, /## \[Unreleased\]\n\n## \[1.0.1\] - 2026-09-27\n\n### Fixed\n- A bug/);
  assert.throws(() => stampChangelog('## [Unreleased]\n\n### Added\n\n---\n', '1.0.1'));
  assert.throws(() => stampChangelog(source, '1.0.0'));
  assert.throws(() => stampChangelog(source + '\n## [Unreleased]\n', '1.0.1'));
});

test('CLI integration: preflight, dry run, lockfiles, atomic push, check and recovery', async t => {
  const root = mkdtempSync(join(tmpdir(), 'atom-ship-'));
  const repo = join(root, 'repo');
  const remote = join(root, 'remote.git');
  mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  let registryVersion = null;
  const server = createServer((req, res) => {
    if (registryVersion && req.url.endsWith(`/${registryVersion}`)) {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({ name: '@test/fixture', version: registryVersion }));
    } else { res.statusCode = 404; res.end('{}'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); rmSync(root, { recursive: true, force: true }); });
  const run = (...args) => new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [cli, ...args], { cwd: repo, env: { ...process.env, GITHUB_REF_NAME: '' } });
    let output = '';
    child.stdout.on('data', data => output += data);
    child.stderr.on('data', data => output += data);
    child.on('error', reject);
    child.on('close', code => resolve({ code, output }));
  });
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Ship Test');
  git('config', 'user.email', 'ship@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('config', 'tag.gpgsign', 'false');
  git('init', '--bare', remote);
  git('remote', 'add', 'origin', remote);
  const pkg = { name: '@test/fixture', version: '1.0.0', ship: { registry: `http://127.0.0.1:${server.address().port}`, verify: [] } };
  writeFileSync(join(repo, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  writeFileSync(join(repo, 'package-lock.json'), JSON.stringify({ name: pkg.name, version: pkg.version, lockfileVersion: 3, packages: { '': { name: pkg.name, version: pkg.version } } }) + '\n');
  const changelog = '# Changelog\n\n## [Unreleased]\n\n### Added\n- A feature\n';
  writeFileSync(join(repo, 'CHANGELOG.md'), changelog);
  git('add', '.'); git('commit', '-m', 'initial'); git('push', '-u', 'origin', 'main');
  const before = git('rev-parse', 'HEAD');
  let result = await run('patch', '--dry-run');
  assert.equal(result.code, 0, result.output);
  assert.equal(git('status', '--porcelain'), '');
  assert.equal(git('rev-parse', 'HEAD'), before);
  writeFileSync(join(repo, 'unrelated.txt'), 'do not release');
  git('add', 'unrelated.txt');
  result = await run('patch');
  assert.notEqual(result.code, 0);
  assert.match(result.output, /must be clean/);
  git('reset', '--', 'unrelated.txt'); rmSync(join(repo, 'unrelated.txt'));
  git('tag', 'v0.9.0');
  result = await run('minor');
  assert.equal(result.code, 0, result.output);
  assert.equal(git('status', '--porcelain'), '');
  const lock = JSON.parse(readFileSync(join(repo, 'package-lock.json'), 'utf8'));
  assert.equal(lock.version, '1.1.0'); assert.equal(lock.packages[''].version, '1.1.0');
  assert.equal(git('ls-remote', '--tags', 'origin', 'refs/tags/v0.9.0'), '');
  assert.match(git('ls-remote', '--tags', 'origin', 'refs/tags/v1.1.0'), /refs\/tags\/v1.1.0/);
  result = await run('validate', '--tag', 'v1.1.0'); assert.equal(result.code, 0, result.output);
  result = await run('validate'); assert.equal(result.code, 0, result.output);
  result = await run('validate', '--tag', 'v1.2.0'); assert.notEqual(result.code, 0);
  registryVersion = '1.1.0';
  result = await run('check'); assert.equal(result.code, 0, result.output);
  registryVersion = null;
  result = await run('check'); assert.notEqual(result.code, 0);
  // A rejected commit must restore both manifest and changelog.
  writeFileSync(join(repo, 'CHANGELOG.md'), changelog);
  git('add', '.'); git('commit', '-m', 'next notes'); git('push');
  writeFileSync(join(repo, '.git/hooks/pre-commit'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  result = await run('patch'); assert.notEqual(result.code, 0);
  assert.equal(git('status', '--porcelain'), '');
  assert.equal(JSON.parse(readFileSync(join(repo, 'package.json'), 'utf8')).version, '1.1.0');
  rmSync(join(repo, '.git/hooks/pre-commit'));
  // Remote rejection leaves recoverable local commit/tag, with neither remote ref updated.
  writeFileSync(join(remote, 'hooks/pre-receive'), '#!/bin/sh\nexit 1\n', { mode: 0o755 });
  const remoteBefore = git('ls-remote', 'origin', 'refs/heads/main');
  result = await run('patch'); assert.notEqual(result.code, 0);
  assert.match(result.output, /Release commit preserved/);
  assert.equal(git('ls-remote', 'origin', 'refs/heads/main'), remoteBefore);
  assert.equal(git('ls-remote', 'origin', 'refs/tags/v1.1.1'), '');
  assert.equal(git('tag', '--list', 'v1.1.1'), 'v1.1.1');
});

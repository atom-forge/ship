/**
 * Wizard tests with disposable repositories and injected interaction adapters.
 *
 * Git file/commit/push behavior is exercised against a local bare repository.
 * npm authentication, first publish and trust responses are simulated, so no
 * test creates a public package or grants a real workflow publishing access.
 */
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync, mkdirSync, readFileSync, writeFileSync, existsSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
import {init, matchingTrust} from '../src/init.js';
import {githubRepository} from '../src/init-plan.js';
import {publishWorkflow} from '../src/workflow.js';

test('workflow template uses locked installs, OIDC, project verification and custom tag prefixes', () => {
  for (const [manager, managerVersion, install] of [['npm', '11.16.0', 'npm ci'], ['bun', '1.4.0', 'bun install --frozen-lockfile'], ['pnpm', '10.0.0', 'pnpm install --frozen-lockfile'], ['yarn', '1.22.22', 'yarn install --frozen-lockfile']]) {
    const content = publishWorkflow({manager, managerVersion, install, verify: ['echo "checks: okay"'], tagPrefix: 'release/'});
    assert.ok(content.includes('id-token: write'));
    assert.ok(content.includes('"release/*"'));
    assert.ok(content.includes(JSON.stringify(install)));
    assert.ok(content.includes(JSON.stringify('echo "checks: okay"')));
    assert.ok(content.includes(`${manager} run pub-validate`));
    assert.ok(content.includes('npm publish --access public --ignore-scripts'));
    assert.ok(!content.includes('--provenance'));
    assert.ok(!content.includes('npm version'));
  }
});

test('GitHub remote parsing and trust matching distinguish wrong workflow, permission and environment', () => {
  for (const url of ['git@github.com:owner/project.git', 'git+https://github.com/owner/project.git', 'ssh://git@github.com/owner/project.git']) assert.equal(githubRepository(url), 'owner/project');
  assert.equal(githubRepository('https://example.org/owner/project.git'), null);
  const trust = 'type: github\nid: fixture\nfile: publish.yml\nrepository: owner/project\npermissions: publish, stage publish\n';
  assert.equal(matchingTrust(trust, 'owner/project', 'publish.yml'), true);
  assert.equal(matchingTrust(trust.replace('github', '\u001b[32mgithub\u001b[0m'), 'owner/project', 'publish.yml'), true);
  assert.equal(matchingTrust(trust, 'owner/project', 'other.yml'), false);
  assert.equal(matchingTrust(trust.replace('publish, stage publish', 'stage publish'), 'owner/project', 'publish.yml'), false);
  assert.equal(matchingTrust(trust + 'environment: protected\n', 'owner/project', 'publish.yml'), false);
});

test('wizard initializes, confirms remote writes, bootstraps npm and resumes without duplicate trust or commits', async t => {
  const originalCwd = process.cwd();
  const root = mkdtempSync(join(tmpdir(), 'ship-init-'));
  const repo = join(root, 'project');
  const remote = join(root, 'remote.git');
  mkdirSync(repo);
  const git = (...args) => execFileSync('git', args, {cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe']}).trim();
  git('init', '--initial-branch=main');
  git('config', 'user.name', 'Ship Test'); git('config', 'user.email', 'ship@example.invalid');
  git('config', 'commit.gpgsign', 'false');
  git('init', '--bare', remote); git('remote', 'add', 'origin', remote);
  writeFileSync(join(repo, 'package.json'), JSON.stringify({name: '@test/project', version: '1.0.0', license: 'MIT', packageManager: 'npm@11.16.0', scripts: {test: 'echo okay'}, devDependencies: {'@atom-forge/ship': '0.1.0'}}, null, 2) + '\n');
  writeFileSync(join(repo, 'package-lock.json'), '{}\n');
  git('add', '.'); git('commit', '-m', 'initial'); git('push', '-u', 'origin', 'main');
  process.chdir(repo);
  t.after(() => { process.chdir(originalCwd); rmSync(root, {recursive: true, force: true}); });
  const calls = [];
  let npmPublished = false;
  let trustExists = false;
  let challengeList = false;
  const run = (command, args, capture) => {
    calls.push([command, ...args]);
    if (command === 'git') {
      if (args.join(' ') === 'remote get-url origin') return 'git@github.com:test/project.git';
      return git(...args);
    }
    if (command === 'npm') {
      if (args[0] === '--version') return '11.16.0';
      if (args[0] === 'trust' && args[1] === 'github') trustExists = true;
      if (args[0] === 'trust' && args[1] === 'list') {
        if (challengeList && capture) throw new Error('EOTP: interactive authentication required');
        return trustExists ? 'type: github\nid: fixture\nfile: publish.yml\nrepository: test/project\npermissions: publish, stage publish\n' : '';
      }
      if (args[0] === 'publish') npmPublished = true;
      return '';
    }
    throw new Error(`Unexpected command: ${command}`);
  };
  const questions = [];
  const prompts = {
    ask: async (label, fallback) => fallback,
    confirm: async label => { questions.push(label); return true; },
  };
  const verified = [];
  const options = {run, prompts, published: async () => npmPublished, verify: commands => verified.push(commands)};
  assert.equal((await init({...options, dryRun: true})).ready, false);
  assert.equal(git('status', '--porcelain'), '');
  assert.equal((await init(options)).ready, true);
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.equal(pkg.scripts.pub, 'ship-it');
  assert.equal(pkg.scripts['pub-validate'], 'ship-it validate');
  assert.deepEqual(pkg.ship.verify, ['npm run test']);
  assert.ok(readFileSync('CHANGELOG.md', 'utf8').includes('## [1.0.0]'));
  assert.ok(existsSync('.github/workflows/publish.yml'));
  assert.ok(questions.some(label => label.includes('Publish the current')));
  assert.ok(questions.some(label => label.includes('Commit these files')));
  assert.ok(questions.some(label => label.includes('via npm OIDC')));
  const pushed = calls.findIndex(args => args[0] === 'git' && args[1] === 'push');
  const published = calls.findIndex(args => args[0] === 'npm' && args[1] === 'publish');
  const trusted = calls.findIndex(args => args[0] === 'npm' && args[1] === 'trust' && args[2] === 'github');
  assert.ok(pushed < published && published < trusted);
  assert.equal(git('status', '--porcelain'), '');
  const firstHead = git('rev-parse', 'HEAD');
  const trustCreates = calls.filter(args => args[0] === 'npm' && args[1] === 'trust' && args[2] === 'github').length;
  assert.equal((await init(options)).ready, true);
  assert.equal(git('rev-parse', 'HEAD'), firstHead);
  assert.equal(calls.filter(args => args[0] === 'npm' && args[1] === 'trust' && args[2] === 'github').length, trustCreates);
  challengeList = true;
  assert.equal((await init(options)).ready, true);
  assert.ok(questions.some(label => label.startsWith('Does the list contain')));
  assert.equal(calls.filter(args => args[0] === 'npm' && args[1] === 'trust' && args[2] === 'github').length, trustCreates);
  challengeList = false;
  // Existing staged changes stop before any local wizard write.
  writeFileSync('package.json', beforeStage(readFileSync('package.json', 'utf8')));
  git('add', 'package.json');
  const stagedContents = readFileSync('package.json', 'utf8');
  await assert.rejects(() => init(options), /Existing staged files/);
  assert.equal(readFileSync('package.json', 'utf8'), stagedContents);
  git('reset', '--', 'package.json');
  writeFileSync('package.json', git('show', 'HEAD:package.json') + '\n');
  // Declining an existing-workflow replacement preserves all files and stops before remote writes.
  writeFileSync('.github/workflows/publish.yml', '# custom workflow\n');
  const before = readFileSync('package.json', 'utf8');
  const countBefore = calls.length;
  assert.equal((await init({...options, prompts: {...prompts, confirm: async () => false}})).ready, false);
  assert.equal(readFileSync('package.json', 'utf8'), before);
  assert.equal(readFileSync('.github/workflows/publish.yml', 'utf8'), '# custom workflow\n');
  assert.ok(!calls.slice(countBefore).some(args => args[0] === 'npm' && args[1] === 'publish'));
});

function beforeStage(content) {
  const pkg = JSON.parse(content);
  pkg.description = 'An unrelated staged change';
  return JSON.stringify(pkg, null, 2) + '\n';
}

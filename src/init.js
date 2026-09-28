/**
 * Guided setup from an installed Ship dependency to a ready release workflow.
 *
 * The wizard prepares local configuration before requesting remote changes.
 * It can bootstrap a new npm package, commit/push only setup files, and create
 * the GitHub Trusted Publisher via npm's CLI. Publishing, replacing an existing
 * workflow, Git writes, and trust changes each require explicit confirmation.
 * Setup is resumable; rerunning it preserves matching files and existing trust.
 */
import {mkdirSync, writeFileSync, existsSync} from 'node:fs';
import {join, resolve} from 'node:path';
import {execFileSync} from 'node:child_process';
import {stripVTControlCharacters} from 'node:util';
import {fail} from './errors.js';
import {project} from './project.js';
import {stampChangelog} from './changelog.js';
import {isPublished} from './registry.js';
import {verify as verifyCommands} from './verify.js';
import {createPrompts} from './prompts.js';
import {githubRepository, initializedManifest, jsonText, lockedInstall, readOptional, setupChangelog, suggestManager, suggestedVerify} from './init-plan.js';
import {managers, publishWorkflow} from './workflow.js';

function runner(cwd) {
  return (command, args, capture = false) => execFileSync(command, args, {
    cwd, encoding: 'utf8', stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })?.trim() ?? '';
}

async function confirmTrust(run, ui, name, repository, workflow) {
  const args = ['trust', 'list', name, '--registry=https://registry.npmjs.org'];
  try {
    return matchingTrust(run('npm', args, true), repository, workflow);
  } catch {
    // npm's browser/OTP challenge requires both stdin and stdout to be TTYs.
    // Captured output disables that flow, so retry visibly and let the user
    // confirm the exact fields rather than creating a duplicate blindly.
    console.log('npm needs interactive authentication. Inspect the publisher list below.');
    run('npm', args);
    return ui.confirm(`Does the list contain ${repository}, ${workflow}, publish permission, and no environment restriction?`);
  }
}

export function matchingTrust(output, repository, workflow) {
  return stripVTControlCharacters(output).split(/(?=^type:)/m).some(block => {
    const fields = Object.fromEntries(block.trim().split(/\r?\n/).map(line => {
      const index = line.indexOf(':');
      return [line.slice(0, index).trim(), line.slice(index + 1).trim()];
    }));
    return fields.type === 'github' && fields.repository === repository && fields.file === workflow
      && !fields.environment && fields.permissions?.split(',').map(value => value.trim()).includes('publish');
  });
}

export async function init({dryRun = false, prompts, run = runner(process.cwd()), published = isPublished, verify = verifyCommands} = {}) {
  const cwd = process.cwd();
  const {pkg, config} = project();
  if (resolve(run('git', ['rev-parse', '--show-toplevel'], true)) !== cwd) fail('Run init from the Git repository root.');
  if (run('git', ['diff', '--cached', '--name-only'], true)) fail('Existing staged files are preserved. Unstage/review them before running init.');
  const self = pkg.name === '@atom-forge/ship' && pkg.bin?.['ship-it'] === 'bin/ship-it.js';
  if (!self && !pkg.devDependencies?.['@atom-forge/ship'] && !pkg.dependencies?.['@atom-forge/ship']) fail('Install @atom-forge/ship in this project before running init.');
  const remote = config.remote;
  const remoteURL = run('git', ['remote', 'get-url', remote], true);
  const repository = githubRepository(remoteURL);
  if (!repository) fail('init currently requires a GitHub remote.');
  if (new URL(config.registry).origin !== 'https://registry.npmjs.org') fail('Trusted Publisher setup currently supports registry.npmjs.org only.');
  const managerSuggestion = suggestManager(pkg, cwd);
  const suggestion = {package: pkg.name, repository, branch: config.branch, remote, manager: managerSuggestion, verify: suggestedVerify(pkg, managerSuggestion), workflow: '.github/workflows/publish.yml'};
  if (dryRun) {
    console.log(JSON.stringify(suggestion, null, 2));
    console.log('Plan only. Interactive init confirms commands and all writes.');
    return {ready: false, plan: suggestion};
  }
  const dependencies = {...pkg.dependencies, ...pkg.devDependencies, ...pkg.optionalDependencies};
  for (const [name, value] of Object.entries(dependencies)) {
    if (/^(?:link:|workspace:|file:(?:\.\.\/|\/))/.test(value)) fail(`CI cannot install ${name} from ${value}. Use a registry dependency or configure its checkout manually before running init.`);
  }
  const ui = prompts ?? createPrompts();
  try {
    console.log(`Configure releases for ${pkg.name} (${repository}).`);
    const manager = await ui.ask('Package manager for installation and CI', managerSuggestion);
    if (!managers.includes(manager)) fail(`Choose one of: ${managers.join(', ')}.`);
    let managerVersion = pkg.packageManager?.startsWith(`${manager}@`) ? pkg.packageManager.slice(manager.length + 1) : '';
    try { managerVersion ||= run(manager, ['--version'], true); } catch { /* Prompt for a version if the manager is absent. */ }
    managerVersion = await ui.ask(`Exact ${manager} version for CI`, managerVersion);
    if (manager === 'yarn' && !managerVersion.startsWith('1.')) fail('The wizard currently supports Yarn Classic (1.x). Other Yarn versions can configure workflows manually.');
    if (manager === 'npm') {
      const parts = managerVersion.split('.').map(Number);
      if (parts[0] < 11 || (parts[0] === 11 && (parts[1] < 5 || (parts[1] === 5 && parts[2] < 1)))) fail('CI requires npm 11.5.1 or later for OIDC.');
    }
    const commands = await ui.ask('Verification commands as a JSON array', JSON.stringify(suggestedVerify(pkg, manager)));
    let verification;
    try { verification = JSON.parse(commands); } catch { fail('Verification commands must be a JSON array of strings.'); }
    if (!Array.isArray(verification) || verification.some(value => typeof value !== 'string' || !value.trim())) fail('Verification commands must be nonempty strings.');
    if (verification.some(command => /(?:^|\s)(?:ship-it|npm publish|(?:npm|bun|pnpm|yarn) run pub)(?:\s|$)/.test(command))) fail('Verification must not invoke a release or publish command.');
    if (!verification.length && !await ui.confirm('No build or test checks configured. Continue?')) return {ready: false};
    const branch = await ui.ask('Release branch', config.branch);
    run('git', ['check-ref-format', `refs/heads/${branch}`], true);
    if (run('git', ['branch', '--show-current'], true) !== branch) fail(`Switch to ${branch} before running init.`);
    const workflowName = await ui.ask('Publishing workflow filename', 'publish.yml');
    if (!/^[\w-]+\.ya?ml$/.test(workflowName)) fail('Use a simple workflow filename ending in .yml or .yaml.');
    const workflowPath = `.github/workflows/${workflowName}`;
    const install = self ? '' : lockedInstall(manager, cwd);
    const workflow = publishWorkflow({manager, managerVersion, install, verify: verification, tagPrefix: config.tagPrefix, self});
    const oldWorkflow = readOptional(join(cwd, workflowPath));
    const files = new Map();
    if (oldWorkflow && oldWorkflow !== workflow) {
      if (!await ui.confirm(`Replace existing ${workflowPath}? Its contents will be backed up.`)) return {ready: false};
      const backup = `${workflowPath}.ship-backup`;
      if (existsSync(join(cwd, backup))) fail(`Backup already exists: ${backup}. Move it before replacing another workflow.`);
      files.set(backup, oldWorkflow);
    }
    const next = initializedManifest(pkg, {repository, branch, remote, verify: verification});
    files.set('package.json', jsonText(readOptional('package.json'), next));
    files.set(workflowPath, workflow);
    const oldChangelog = readOptional(config.changelog);
    const setupChanged = [...files].some(([path, content]) => readOptional(join(cwd, path)) !== content);
    let changelog = setupChanged || !oldChangelog ? setupChangelog(oldChangelog) : oldChangelog;
    const alreadyPublished = await published(pkg, config, pkg.version);
    let firstPublish = false;
    if (!alreadyPublished) {
      console.log(`${pkg.name}@${pkg.version} is not published. The first publish must use your npm account.`);
      firstPublish = await ui.confirm(`Publish the current ${pkg.version} version after verification and setup commit?`);
      if (firstPublish && !changelog.includes(`## [${pkg.version}]`)) changelog = stampChangelog(changelog, pkg.version);
    }
    files.set(config.changelog, changelog);
    const changed = [...files].filter(([path, content]) => readOptional(join(cwd, path)) !== content);
    console.log(`\nSetup files: ${changed.map(([path]) => path).join(', ') || 'already up to date'}`);
    console.log(`Verification: ${JSON.stringify(verification)}`);
    if (changed.length) {
      if (!await ui.confirm('Write these setup files?', true)) return {ready: false};
      for (const [path, content] of changed) {
        mkdirSync(resolve(cwd, path, '..'), {recursive: true});
        writeFileSync(join(cwd, path), content);
      }
    }
    if (!await ui.confirm('Run the verification commands and inspect the package now?', true)) {
      console.log('Local setup saved. Rerun init to finish verification and remote setup.');
      return {ready: false};
    }
    verify(verification);
    run('npm', ['pack', '--dry-run', '--ignore-scripts']);
    const lockfiles = ['bun.lock', 'bun.lockb', 'package-lock.json', 'npm-shrinkwrap.json', 'pnpm-lock.yaml', 'yarn.lock'];
    const allowed = new Set([...files.keys(), ...lockfiles.filter(file => existsSync(join(cwd, file)))]);
    const modified = run('git', ['diff', '--name-only'], true).split('\n').filter(Boolean);
    const untracked = run('git', ['ls-files', '--others', '--exclude-standard'], true).split('\n').filter(Boolean);
    if (run('git', ['diff', '--cached', '--name-only'], true)) fail('Existing staged files are preserved. Unstage/review them before finishing init.');
    const pending = [...new Set([...modified, ...untracked])];
    const unrelated = pending.filter(path => !allowed.has(path));
    if (unrelated.length) fail(`Local setup saved. Commit unrelated changes before finishing init: ${unrelated.join(', ')}`);
    const remoteHead = run('git', ['ls-remote', remote, `refs/heads/${branch}`], true).split(/\s/)[0];
    const head = run('git', ['rev-parse', 'HEAD'], true);
    // A previous interrupted setup may have committed locally but not pushed.
    if (remoteHead && remoteHead !== head) {
      const ancestor = run('git', ['merge-base', remoteHead, head], true);
      if (ancestor !== remoteHead) fail('Local and remote branches diverged. Synchronize them before finishing setup.');
    }
    if (pending.length || remoteHead !== head) {
      console.log(`Git setup files: ${pending.join(', ') || '(existing local commits)'}`);
      if (!await ui.confirm(`Commit these files and push ${branch} to ${remote}?`)) {
        console.log('Local setup saved. Commit/push it and rerun init before enabling Trusted Publishing.');
        return {ready: false};
      }
      if (pending.length) {
        run('git', ['add', '--', ...pending]);
        run('git', ['commit', '-m', 'Configure releases with Ship']);
      }
      run('git', ['push', remote, `HEAD:refs/heads/${branch}`]);
    }
    if (!alreadyPublished) {
      if (!firstPublish) {
        console.log('Local setup is ready. Publish the first version with npm login / npm publish, then rerun init to configure trust.');
        return {ready: false};
      }
      try { run('npm', ['whoami', '--registry=https://registry.npmjs.org'], true); }
      catch {
        if (!await ui.confirm('Log in to npm now? Browser/2FA authentication may be required.', true)) return {ready: false};
        run('npm', ['login', '--registry=https://registry.npmjs.org']);
      }
      run('npm', ['publish', '--access', 'public', '--ignore-scripts', '--registry=https://registry.npmjs.org']);
      console.log('First version published. npm may take a short time to expose the package settings.');
    }
    const npmVersion = run('npm', ['--version'], true).split('.').map(Number);
    if (npmVersion[0] < 11 || (npmVersion[0] === 11 && npmVersion[1] < 15)) fail('Setup saved. Trusted Publisher setup requires npm >=11.15.0. Update npm and rerun init.');
    if (!await confirmTrust(run, ui, pkg.name, repository, workflowName)) {
      if (!await ui.confirm(`Allow ${repository}/${workflowName} to publish ${pkg.name} via npm OIDC?`)) {
        console.log('Workflow saved. Rerun init to complete Trusted Publisher setup.');
        return {ready: false};
      }
      run('npm', ['trust', 'github', pkg.name, `--file=${workflowName}`, `--repo=${repository}`, '--allow-publish', '--yes', '--registry=https://registry.npmjs.org']);
      if (!await confirmTrust(run, ui, pkg.name, repository, workflowName)) fail('npm did not confirm the expected publisher. Verify package settings and rerun init.');
    }
    console.log(`\nReady. Write your next changes in ${config.changelog}, commit/push them, then run ${manager} run pub.`);
    return {ready: true};
  } finally { ui.close?.(); }
}

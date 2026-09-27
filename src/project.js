/**
 * Project manifest and `package.json.ship` configuration loader.
 *
 * This module validates the small, runtime-independent configuration surface
 * and determines which version-bearing files participate in a release. It
 * intentionally does not infer package managers or project build commands.
 */
import { existsSync, readFileSync } from 'node:fs';
import { isAbsolute, relative, resolve } from 'node:path';
import { fail } from './errors.js';
import { stableVersion } from './version.js';

const defaults = { branch: 'main', remote: 'origin', tagPrefix: 'v', changelog: 'CHANGELOG.md', verify: [], registry: 'https://registry.npmjs.org' };
const configKeys = new Set(Object.keys(defaults));

export function project() {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  if (pkg.ship !== undefined && (!pkg.ship || typeof pkg.ship !== 'object' || Array.isArray(pkg.ship))) fail('ship must be a configuration object.');
  for (const key of Object.keys(pkg.ship ?? {})) if (!configKeys.has(key)) fail(`Unknown ship setting: ${key}`);
  const config = { ...defaults, ...pkg.ship };
  if (!pkg.name || !stableVersion.test(pkg.version)) fail('package.json needs a name and stable version.');
  if (pkg.private) fail('Private packages cannot be released.');
  if (!Array.isArray(config.verify) || config.verify.some(command => typeof command !== 'string' || !command.trim())) fail('ship.verify must be an array of commands.');
  for (const key of ['branch', 'remote', 'tagPrefix', 'changelog', 'registry']) {
    if (typeof config[key] !== 'string' || !config[key] || config[key].startsWith('-')) fail(`Invalid ship.${key}.`);
  }
  const changelogPath = relative(process.cwd(), resolve(config.changelog));
  if (['package.json', 'package-lock.json', 'npm-shrinkwrap.json'].includes(changelogPath) || changelogPath.startsWith('..') || isAbsolute(changelogPath)) fail('Changelog must be a separate file inside the project.');
  return { pkg, config };
}

export function releaseFiles(config) {
  const files = ['package.json', config.changelog];
  for (const file of ['package-lock.json', 'npm-shrinkwrap.json']) if (existsSync(file)) files.push(file);
  return files;
}

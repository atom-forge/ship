/**
 * CLI argument router for Atom Ship.
 *
 * It routes command-line input to setup, release, exact-version publication
 * checks, or CI validation. It does not
 * implement Git, registry, or file behavior; those responsibilities remain
 * in their dedicated modules.
 */
import { fail } from './errors.js';
import { git } from './git.js';
import { project } from './project.js';
import { check, release, validate } from './release.js';
import { init } from './init.js';

export async function main(args = []) {
  if (args.includes('--help') || args[0] === 'help') {
    console.log('ship-it init [--dry-run]\nship-it [patch|minor|major|x.y.z] [--dry-run]\nship-it check [--wait seconds]\nship-it validate [--tag vX.Y.Z]\nConfiguration: package.json "ship": { "verify": ["npm test"] }');
    return;
  }
  const command = args[0]?.startsWith('--') ? 'patch' : (args.shift() ?? 'patch');
  if (command === 'init') {
    if (args.length && (args.length !== 1 || args[0] !== '--dry-run')) fail('Usage: ship-it init [--dry-run]');
    return init({dryRun: args[0] === '--dry-run'});
  }
  const { pkg, config } = project();
  if (command === 'check') {
    if (args.length && (args.length !== 2 || args[0] !== '--wait' || !/^\d+$/.test(args[1]))) fail('Usage: ship-it check [--wait seconds]');
    const seconds = Number(args[1] ?? 0);
    if (!Number.isSafeInteger(seconds) || seconds > 3600) fail('Wait must be 0–3600 seconds.');
    return check(pkg, config, seconds);
  }
  if (command === 'validate') {
    if (args.length && (args.length !== 2 || args[0] !== '--tag')) fail('Usage: ship-it validate [--tag vX.Y.Z]');
    return validate(pkg, config, args[1] ?? (process.env.GITHUB_REF_NAME || git('describe', '--tags', '--exact-match')));
  }
  if (args.length && (args.length !== 1 || args[0] !== '--dry-run')) fail('Unknown arguments. See --help.');
  return release(pkg, config, command, args[0] === '--dry-run');
}

/**
 * Configured project-command runner.
 *
 * Ship treats verification as an ordered list of user-provided commands. This
 * keeps release orchestration independent of Node package managers, Bun,
 * pnpm, Make, or any project's chosen test/build tooling.
 */
import { spawnSync } from 'node:child_process';
import { fail } from './errors.js';

export function verify(commands) {
  for (const command of commands) {
    if (!runCommand(command)) fail(`Verification failed: ${command}`);
  }
}

/**
 * Runs the `ship.after` commands once the release commit and tag are pushed.
 * The release is already complete at this point, so a failure only reports
 * which step to finish by hand. `SHIP_VERSION` and `SHIP_TAG` are exported to
 * the commands.
 */
export function afterRelease(commands, { version, tag }) {
  const env = { ...process.env, SHIP_VERSION: version, SHIP_TAG: tag };
  for (const [index, command] of commands.entries()) {
    if (!runCommand(command, env)) {
      const rest = commands.slice(index + 1);
      fail(`Released ${tag}, but an after-release command failed: ${command}. Do not release again; fix the cause and run it${rest.length ? ' and the remaining commands' : ''} by hand${rest.length ? `: ${rest.join(' ; ')}` : ''}.`);
    }
  }
}

function runCommand(command, env = process.env) {
  console.log(`> ${command}`);
  const result = spawnSync(command, { shell: true, stdio: 'inherit', env });
  return !result.error && result.status === 0;
}

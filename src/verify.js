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
    console.log(`> ${command}`);
    const result = spawnSync(command, { shell: true, stdio: 'inherit' });
    if (result.error || result.status !== 0) fail(`Verification failed: ${command}`);
  }
}

/**
 * Interactive questions used by the initialization wizard.
 *
 * Each filesystem or remote mutation has an explicit confirmation. The prompt
 * adapter can be replaced in tests so the wizard never needs real credentials,
 * user input, or external writes during its automated verification.
 */
import {createInterface} from 'node:readline/promises';
import {stdin, stdout} from 'node:process';
import {fail} from './errors.js';

export function createPrompts() {
  if (!stdin.isTTY || !stdout.isTTY) fail('init requires an interactive terminal. Use init --dry-run to inspect the local plan.');
  const rl = createInterface({input: stdin, output: stdout});
  return {
    async ask(label, fallback = '') {
      const answer = await rl.question(`${label}${fallback ? ` [${fallback}]` : ''}: `);
      return answer.trim() || fallback;
    },
    async confirm(label, fallback = false) {
      while (true) {
        const answer = (await rl.question(`${label} ${fallback ? '[Y/n]' : '[y/N]'}: `)).trim().toLowerCase();
        if (!answer) return fallback;
        if (['y', 'yes'].includes(answer)) return true;
        if (['n', 'no'].includes(answer)) return false;
      }
    },
    close() { rl.close(); },
  };
}

/**
 * Stable semantic-version validation and bumping.
 *
 * The initial Ship release flow intentionally accepts only increasing stable
 * x.y.z versions. Keeping the rule pure and isolated makes its limits clear
 * and leaves a future prerelease policy independent from the Git workflow.
 */
import { fail } from './errors.js';

export const stableVersion = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

export function nextVersion(current, bump) {
  if (!stableVersion.test(current)) fail(`Unsupported current version: ${current}`);
  const parts = current.split('.').map(BigInt);
  const index = ['major', 'minor', 'patch'].indexOf(bump);
  let target = bump;
  if (index >= 0) {
    parts[index] += 1n;
    for (let i = index + 1; i < 3; i++) parts[i] = 0n;
    target = parts.join('.');
  }
  if (!stableVersion.test(target)) fail('Use patch, minor, major, or a stable x.y.z version.');
  const old = current.split('.').map(BigInt);
  const next = target.split('.').map(BigInt);
  const diff = next.findIndex((part, i) => part !== old[i]);
  if (diff < 0 || next[diff] < old[diff]) fail('The release version must increase.');
  return target;
}

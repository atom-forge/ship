/**
 * Read-only npm-compatible registry lookup.
 *
 * Before Ship releases or confirms a release, it asks for the exact package
 * version rather than relying on the mutable `latest` dist-tag. Authentication
 * and publishing remain CI responsibilities outside this module.
 */
import { fail } from './errors.js';

export async function isPublished(pkg, config, version) {
  const base = new URL(config.registry);
  if (base.protocol !== 'https:' && base.hostname !== 'localhost' && base.hostname !== '127.0.0.1') fail('Registry must use HTTPS.');
  const url = `${base.href.replace(/\/$/, '')}/${encodeURIComponent(pkg.name)}/${encodeURIComponent(version)}`;
  const response = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (response.status === 404) return false;
  if (!response.ok) fail(`Registry returned HTTP ${response.status}.`);
  const data = await response.json();
  if (data.name !== pkg.name || data.version !== version) fail('Unexpected registry response.');
  return true;
}

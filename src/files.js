/**
 * Transaction-like helpers for release metadata files.
 *
 * A release snapshots tracked manifests before changing them, updates only
 * their version fields, and restores the original contents if the commit has
 * not yet succeeded. This module deliberately knows nothing about Git.
 */
import { readFileSync, writeFileSync } from 'node:fs';

export function snapshot(files) {
  return new Map(files.map(file => [file, readFileSync(file, 'utf8')]));
}

export function writeVersionedJSON(file, content, version) {
  const data = JSON.parse(content);
  data.version = version;
  if (data.packages?.['']) data.packages[''].version = version;
  const indent = content.match(/\n([\t ]+)"/)?.[1] ?? '  ';
  writeFileSync(file, JSON.stringify(data, null, indent) + '\n');
}

export function writeFile(file, content) {
  writeFileSync(file, content);
}

export function restore(snapshot) {
  for (const [file, content] of snapshot) writeFileSync(file, content);
}

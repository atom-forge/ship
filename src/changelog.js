/**
 * Changelog parsing and release-section generation.
 *
 * Ship keeps the current Unreleased notes intact while inserting a dated,
 * versioned heading above them. These functions are pure: callers own all
 * file reads and writes, which makes the release flow safe to preview/test.
 */
import { fail } from './errors.js';

export function stampChangelog(content, version, date = new Date().toISOString().slice(0, 10)) {
  const headings = [...content.matchAll(/^## \[Unreleased\][ \t]*\r?$/gm)];
  if (headings.length !== 1) fail('Changelog must contain exactly one ## [Unreleased] heading.');
  if (content.includes(`## [${version}]`)) fail(`Changelog already contains ${version}.`);
  const heading = headings[0];
  const rest = content.slice(heading.index + heading[0].length);
  const section = rest.split(/^## /m)[0].replace(/^\s*(?:---|###.*)\s*$/gm, '').trim();
  if (!section) fail('The Unreleased section is empty.');
  const nl = content.includes('\r\n') ? '\r\n' : '\n';
  return content.slice(0, heading.index) + `## [Unreleased]${nl}${nl}## [${version}] - ${date}` + rest;
}

export function hasReleaseEntry(content, version) {
  return content.split(/\r?\n/).some(line => line.startsWith(`## [${version}] - `));
}

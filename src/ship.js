/**
 * Public library surface for Atom Ship.
 *
 * Consumers import this stable facade instead of reaching into internal
 * modules. It exposes the CLI entry point and the two pure helpers that are
 * useful for programmatic integration and focused tests.
 */
export { main } from './cli.js';
export { stampChangelog } from './changelog.js';
export { nextVersion } from './version.js';

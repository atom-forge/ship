/**
 * Shared domain-error helper.
 *
 * Ship expresses expected validation and preflight failures as ordinary
 * Errors. The executable entry point is the only layer that formats them for
 * a terminal and decides the process exit code.
 */
export function fail(message) {
  throw new Error(message);
}

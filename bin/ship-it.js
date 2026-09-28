#!/usr/bin/env node
/**
 * Command-line entry point for Atom Ship.
 *
 * This file deliberately contains no release logic. Node and Bun execute it
 * when users run `ship-it`; it passes the user arguments to the public
 * library API, renders a concise error, and returns a non-zero exit code.
 */
import { main } from '../src/ship.js';

try {
  await main(process.argv.slice(2));
} catch (error) {
  console.error(`ship-it: ${error.message}`);
  process.exitCode = 1;
}

#!/usr/bin/env node
/**
 * gen-webdirectives-ssr-vectors.mjs — regenerate the language-neutral JSON export of the Web Directives
 * SSR wire-format golden vectors (#2354, the foundational slice #2069 depends on).
 *
 * `conformance-vectors/webdirectives-ssr.vectors.ts` is the source of truth (TS-only today). Every
 * non-JS renderer (#2069 — Go, Rust, PHP, Python, .NET, JVM…) needs the SAME golden vectors without a
 * Node/TS toolchain, so this script projects the suite to plain JSON — same shape, byte-identical
 * `expectedHtml` — and the committed `webdirectives-ssr.vectors.json` is what those harnesses read. A
 * vitest drift test (`__tests__/webdirectives-ssr-export.test.ts`) asserts the committed file equals a
 * fresh projection, so it can never go stale. The grading protocol for how a harness compares a
 * renderer's output against `expectedHtml` is pinned in `webdirectives-ssr-harness-contract.md`
 * (sibling file, hand-authored — not generated).
 *
 * Run: `npm run gen:webdirectives-ssr-vectors`  (writes conformance-vectors/webdirectives-ssr.vectors.json)
 */
import { build } from 'esbuild';
import { readFileSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'conformance-vectors/webdirectives-ssr.vectors.ts');
const OUT = join(ROOT, 'conformance-vectors/webdirectives-ssr.vectors.json');

/** Bundle the vector module to a temp ESM, import it, and return the validated suite. */
export async function projectVectors() {
  const tmp = join(ROOT, 'node_modules/.cache/webdirectives-ssr-vectors.mjs');
  await build({
    entryPoints: [SRC],
    bundle: true,
    format: 'esm',
    platform: 'node',
    outfile: tmp,
    logLevel: 'silent',
  });
  try {
    const mod = await import(`${tmp}?t=${Date.now()}`);
    // Validate before export — a malformed suite must never reach the committed JSON.
    return mod.assertSsrWireSuite(mod.webdirectivesSsrSuite);
  } finally {
    rmSync(tmp, { force: true });
  }
}

/** Stable, pretty JSON with a trailing newline — the on-disk form the drift test compares against. */
export const serialize = (suite) => `${JSON.stringify(suite, null, 2)}\n`;

// Run as a script: write the file. Imported (by the drift test): just expose the helpers above.
if (import.meta.url === `file://${process.argv[1]}`) {
  const suite = await projectVectors();
  const next = serialize(suite);
  let prev = '';
  try {
    prev = readFileSync(OUT, 'utf8');
  } catch {
    /* first run */
  }
  writeFileSync(OUT, next);
  console.log(prev === next ? `✓ webdirectives-ssr.vectors.json up to date` : `✓ wrote ${OUT}`);
}

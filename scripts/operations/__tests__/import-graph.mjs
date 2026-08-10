/**
 * @file scripts/operations/__tests__/import-graph.mjs
 * @description THE STATIC IMPORT-GRAPH SCANNER the operations suite asserts capability claims with (#3032/#3036).
 *
 * NOT A TEST FILE — vitest collects `*.test.mjs` only (`vitest.config.ts#test.include`), so this sits beside the
 * suites that share it, the same way `we:scripts/lib/__tests__/doc-prose.mjs` does.
 *
 * WHY A STATIC GRAPH RATHER THAN A BEHAVIOURAL TEST. A behavioural test shows a module did not act on THIS
 * input; the graph shows it has no way to act on any. `__tests__/engine.test.mjs` uses it for the engine's
 * *"reaches nothing that can act"*, and `__tests__/http-adapter.test.mjs` uses it for the narrower read-only
 * property (see that file — the guarantee is deliberately smaller than it sounds).
 *
 * WHAT IT IS NOT. It reads source text; it does not run a resolver. Three known blind spots, stated because a
 * capability claim built on it must not be read as wider than the scanner:
 *
 *   1. **A specifier that is not a literal** — `import(someVariable)` — is invisible. So is `createRequire()`,
 *      `process.binding`, `eval`, and anything reached through a global (`fetch`, `globalThis.process`), none
 *      of which is an import at all.
 *   2. **Injected values.** A module that imports nothing can still be HANDED a writer at call time. The graph
 *      says what a module can reach through its own scope, never what a caller puts into it.
 *   3. **Package specifiers are not followed** — they are reported as `external` and judged by name.
 *
 * COMMENT- AND STRING-AWARE, unlike the naive regex this replaces: the earlier copy in `engine.test.mjs` scanned
 * raw source, so prose in a JSDoc block (`… different from 'the other thing'`) was reported as an import. That
 * only ever over-reports — it cannot hide a real import — but it makes the scanner unusable on any file with
 * a documented header, which is every file in this directory.
 */

import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

/**
 * Blank out comments and string bodies so a specifier scan sees code only. Returns a same-length string, so
 * offsets are preserved and nothing downstream has to care that this ran.
 *
 * Template literals are blanked wholesale (an `import()` inside `${…}` is a non-literal specifier and is
 * invisible to this scanner either way — see blind spot 1 above). Regex literals are NOT tracked; a `/…/`
 * containing an apostrophe could desynchronise the string state, so {@link importGraph} is only claimed to be
 * correct for the plain-ESM modules in this tree, and its assertions are `toEqual` on the whole set rather
 * than a `not.toContain`, so a desync shows up as a failure rather than as a silent pass.
 *
 * @param {string} src
 * @returns {string}
 */
export function blankCommentsAndStrings(src) {
  const out = [...src];
  let i = 0;
  const blankTo = (end) => { for (let j = i; j < end && j < out.length; j += 1) if (out[j] !== '\n') out[j] = ' '; };
  while (i < src.length) {
    const two = src.slice(i, i + 2);
    if (two === '//') {
      const end = src.indexOf('\n', i);
      blankTo(end === -1 ? src.length : end);
      i = end === -1 ? src.length : end;
    } else if (two === '/*') {
      const end = src.indexOf('*/', i + 2);
      const stop = end === -1 ? src.length : end + 2;
      blankTo(stop);
      i = stop;
    } else if (src[i] === '\'' || src[i] === '"' || src[i] === '`') {
      const quote = src[i];
      let j = i + 1;
      while (j < src.length && src[j] !== quote) {
        if (src[j] === '\\') j += 1;
        j += 1;
      }
      // Keep the quotes themselves so the specifier regex can still bracket a literal; blank only the body
      // for template literals, whose contents are never a specifier this scanner can resolve.
      if (quote === '`') { i += 1; blankTo(j); i = Math.min(j + 1, src.length); } else { i = Math.min(j + 1, src.length); }
    } else {
      i += 1;
    }
  }
  return out.join('');
}

const SPECIFIER_RE = /\bfrom\s+['"]([^'"]+)['"]|\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)|^\s*import\s+['"]([^'"]+)['"]/gm;

/**
 * Every module reachable from `entry` by static or dynamic import, plus every non-relative specifier the walk
 * met. Relative specifiers are followed; package and `node:` specifiers are collected and not followed.
 *
 * @param {string} entry - an absolute path to the entry module.
 * @returns {{files: string[], external: string[]}} both sorted.
 */
export function importGraph(entry) {
  const files = new Set();
  const external = new Set();
  const queue = [entry];
  while (queue.length) {
    const file = queue.pop();
    if (files.has(file)) continue;
    files.add(file);
    const src = blankCommentsAndStrings(readFileSync(file, 'utf8'));
    for (const match of src.matchAll(SPECIFIER_RE)) {
      const spec = match[1] ?? match[2] ?? match[3];
      if (!spec) continue;
      if (spec.startsWith('.')) queue.push(resolve(dirname(file), spec));
      else external.add(spec);
    }
  }
  return { files: [...files].sort(), external: [...external].sort() };
}

/** The file names in a graph, for a legible assertion that does not hard-code an absolute path. */
export function graphBasenames(entry) {
  return importGraph(entry).files.map((f) => f.split('/').pop()).sort();
}

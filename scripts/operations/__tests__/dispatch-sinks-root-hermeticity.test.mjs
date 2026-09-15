/**
 * @file dispatch-sinks-root-hermeticity.test.mjs — REGRESSION GUARD for the real #3637 bug: 16 dispatch-wiring
 * tests failed, GUARANTEED, whenever the whole suite happened to run from inside a lane checkout.
 *
 * WHAT ACTUALLY HAPPENED, confirmed by reproducing it (not assumed from the incident report). `poc-land.mjs`
 * landed a real feature from a lane clone and `verify-lane` reported 16 unrelated failures. Every one of them
 * was `assertNotALaneCheckout` (`../dispatch-lane-io.mjs`) throwing inside `createDispatchSinks`'s
 * `[DISPATCH_EFFECT]`. That guard is CORRECT — it refuses to let a real dispatch acquire a second lane from
 * inside one — but `createDispatchSinks`'s own default `root` is `REPO_ROOT`, and `REPO_ROOT` is resolved from
 * `import.meta.url`, i.e. from WHERE `dispatch-lane-io.mjs` ITSELF happens to be checked out on disk — not from
 * anything the test controls. Six test files across `dispatch-lane-*-wiring.test.mjs` and
 * `dispatch-provider-registry.test.mjs` called `createDispatchSinks({...})` (or, in one file, the bare
 * `createDispatchSinks()`) to test mode ROUTING — never the lane-checkout guard — without pinning `root`. Every
 * one of those was fine from the primary checkout (whose basename is never `lane-<digits>`) and threw,
 * unconditionally, the moment the identical suite ran from a lane clone (`.lanes/web-everything/lane-52`, the
 * ordinary way an agent's own tests run). Reproduced directly: a byte-for-byte copy of this repo onto a
 * `lane-999999`-shaped directory turned exactly those 16 tests red with no code change at all.
 *
 * THE FIX WAS NOT THE GUARD. `assertNotALaneCheckout` is doing its job; changing it would just move the false
 * positive somewhere else (or, worse, let a REAL nested-lane dispatch through). The fix was making every
 * wiring test that is not itself testing the guard pin an explicit, fake, NEVER-lane-shaped `root` — the same
 * `PRIMARY = '/primary/webeverything'` convention `./dispatch-lane.test.mjs`, `./dispatch-kind-axes.test.mjs`
 * and `./dispatch-lane-fixture-harness.test.mjs` already used. This file is the tripwire that keeps it fixed:
 * it reads every dispatch-wiring test file's OWN SOURCE and refuses a `createDispatchSinks(...)` call that can
 * reach `[DISPATCH_EFFECT]` without an explicit `root:` sitting in its argument object. A construction-only call
 * — `expect(() => createDispatchSinks(...)).toThrow(...)` — never reaches the effect and is exempt; every other
 * shape is not.
 *
 * WHY A SOURCE SCAN, AND NOT A "run the suite from inside a real lane clone" INTEGRATION TEST. The literal
 * reproduction needs `dispatch-lane-io.mjs`'s FILE to physically sit under a `lane-<digits>` directory — a
 * symlink does not fool it (Node resolves `import.meta.url` through symlinks to the real path), so a faithful
 * repro needs an actual copy of the repo (proven above) — too slow and too filesystem-heavy to keep as a
 * standing, every-run unit test, and it would only prove today's six files, not the NEXT wiring test someone
 * adds without `root:`. A source scan is instant, needs no copy, and catches the mistake in the one file that
 * would ever make it: whichever test forgets to pin `root`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SELF = 'dispatch-sinks-root-hermeticity.test.mjs';

/** Every OTHER test file in this directory that calls `createDispatchSinks` at all — found by content, not by
 *  name, so a NEW wiring test file is covered automatically rather than needing to be added to a list here.
 *  Excludes THIS file: its own docblock and its own fixture strings mention `createDispatchSinks(...)` in
 *  prose, not as a real call this scanner should judge. */
const CANDIDATE_FILES = readdirSync(HERE)
  .filter((f) => f.endsWith('.test.mjs') && f !== SELF)
  .filter((f) => readFileSync(join(HERE, f), 'utf8').includes('createDispatchSinks'));

/** Strip `/** … *\/` block comments and `// …` line comments so a call MENTIONED in prose (a docblock
 *  explaining what a sibling file does, e.g. `./dispatch-lane-prepare-decision-wiring.test.mjs`'s own header)
 *  is never mistaken for a real call site. Good enough for this repo's `.mjs` sources: none of them puts a
 *  `//` inside a string or regex literal that also contains `createDispatchSinks`. Blanks each comment out to
 *  SPACES rather than deleting it, preserving every newline, so line numbers computed against the result still
 *  match the original file. */
function stripComments(source) {
  const blankBlock = (block) => block.replace(/[^\n]/g, ' ');
  return source
    .replace(/\/\*[\s\S]*?\*\//g, blankBlock)
    .replace(/\/\/[^\n]*/g, blankBlock);
}

/**
 * Every `createDispatchSinks(...)` call site in `source` that is NOT construction-only, alongside whether its
 * own argument object pins `root:`. PURE — no fs, so it is trivially testable against fixture strings.
 *
 * "Construction-only" means the call is the direct argument of an arrow function passed to `expect(...)` —
 * this codebase's one shape for "assert this throws at construction" (e.g. a typo'd mode env var) — which by
 * construction never reaches `[DISPATCH_EFFECT]` and so never runs `assertNotALaneCheckout` at all.
 *
 * @param {string} rawSource
 * @returns {{line: number, hasRoot: boolean}[]}
 */
export function findCreateDispatchSinksCalls(rawSource) {
  const source = stripComments(rawSource);
  const results = [];
  const CALL_RE = /createDispatchSinks\s*\(/g;
  let m;
  while ((m = CALL_RE.exec(source)) !== null) {
    const openParenIndex = m.index + m[0].length - 1;
    const before = source.slice(Math.max(0, m.index - 40), m.index);
    if (/=>\s*$/.test(before)) continue; // construction-only — see the docblock above

    let depth = 0;
    let end = -1;
    for (let i = openParenIndex; i < source.length; i += 1) {
      if (source[i] === '(') depth += 1;
      else if (source[i] === ')') {
        depth -= 1;
        if (depth === 0) { end = i; break; }
      }
    }
    const argText = end === -1 ? source.slice(m.index) : source.slice(m.index, end + 1);
    const line = source.slice(0, m.index).split('\n').length;
    results.push({ line, hasRoot: /\broot\s*:/.test(argText) });
  }
  return results;
}

describe('#3637 — a dispatch-wiring test never depends on createDispatchSinks\'s ambient default root', () => {
  it('every non-construction-only call in every wiring/registry test file pins an explicit `root:`', () => {
    const offenders = [];
    for (const file of CANDIDATE_FILES) {
      const source = readFileSync(join(HERE, file), 'utf8');
      for (const call of findCreateDispatchSinksCalls(source)) {
        if (!call.hasRoot) offenders.push(`${file}:${call.line}`);
      }
    }
    expect(
      offenders,
      offenders.length
        ? `createDispatchSinks() at ${offenders.join(', ')} does not pin \`root:\`. Its default root `
          + '(REPO_ROOT) is resolved from where dispatch-lane-io.mjs is checked out on disk, so this call throws '
          + '`assertNotALaneCheckout` whenever the suite happens to run from inside a lane clone — the exact '
          + '#3637 regression (16 guaranteed false failures). Pin a fixed, non-lane-shaped root (this file\'s '
          + "sibling tests' own `PRIMARY = '/primary/webeverything'`) unless the test is deliberately exercising "
          + 'the lane-checkout guard itself.'
        : undefined,
    ).toEqual([]);
  });

  it('sanity: the scanner itself tells a pinned call from an unpinned one, and exempts construction-only calls', () => {
    expect(findCreateDispatchSinksCalls("const s = createDispatchSinks({ root: PRIMARY, buildMode: 'agent' });"))
      .toEqual([{ line: 1, hasRoot: true }]);
    expect(findCreateDispatchSinksCalls("const s = createDispatchSinks({ buildMode: 'agent' });"))
      .toEqual([{ line: 1, hasRoot: false }]);
    expect(findCreateDispatchSinksCalls('const s = createDispatchSinks();'))
      .toEqual([{ line: 1, hasRoot: false }]);
    expect(findCreateDispatchSinksCalls("expect(() => createDispatchSinks({ modes: {} })).toThrow(/x/);"))
      .toEqual([]);
    // A root-pinned call spanning several lines is still found — the balanced-paren scan, not a single-line
    // regex, is what makes that true.
    expect(findCreateDispatchSinksCalls([
      'const sinks = createDispatchSinks({',
      '  modes: dispatchModesFromEnv({}),',
      '  root: PRIMARY,',
      '});',
    ].join('\n'))).toEqual([{ line: 1, hasRoot: true }]);
  });
});

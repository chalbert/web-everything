/**
 * @file scope-consumers.test.mjs — proof that the consumers check earns its place on REAL history.
 *
 * The load-bearing tests are the three replays at the bottom. This check exists because three of four
 * surveyed items burned review rounds on consumers their card never named; a fixture invented to make the
 * check pass would prove nothing, so the replays reconstruct each item's `scope:` AS IT WAS WRITTEN and
 * assert the check names the file the reviewers had to find by hand.
 */

import { describe, it, expect } from 'vitest';

import {
  relativeImportsIn, resolveSpecifier, consumerIndex, isTestFile,
  scopeConsumerGaps, scopeNamesNoTest, assessScope, blankCommentsAndStrings, BLIND_SPOTS,
} from '../scope-consumers.mjs';

describe('the specifier scan sees code, not prose', () => {
  it('finds static, dynamic and side-effect imports', () => {
    const src = [
      "import { a } from './a.mjs';",
      "import './side-effect.mjs';",
      "const x = await import('../deep/b.mjs');",
      "export { c } from './c.mjs';",
    ].join('\n');
    expect(relativeImportsIn(src)).toEqual(['./a.mjs', '../deep/b.mjs', './c.mjs', './side-effect.mjs'].sort((p, q) => src.indexOf(p) - src.indexOf(q)));
  });

  // The naive regex this replaces scanned raw source, so a docblock mentioning a path read as an import.
  // Every module in this tree has a documented header, so that is not a corner case here.
  it('ignores a specifier-shaped string inside a comment or a docblock', () => {
    const src = [
      '/**',
      " * See `from './not-an-import.mjs'` for the reason.",
      ' */',
      "// import { nope } from './commented-out.mjs';",
      "import { real } from './real.mjs';",
    ].join('\n');
    expect(relativeImportsIn(src)).toEqual(['./real.mjs']);
  });

  it('drops package and node: specifiers — neither can name a file in this repo', () => {
    const src = "import { readFileSync } from 'node:fs';\nimport vitest from 'vitest';\nimport { x } from './x.mjs';";
    expect(relativeImportsIn(src)).toEqual(['./x.mjs']);
  });

  it('blanking preserves length, so nothing downstream has to know it ran', () => {
    const src = "const a = 'hello';\n// comment\nimport { x } from './x.mjs';";
    expect(blankCommentsAndStrings(src)).toHaveLength(src.length);
  });

  /**
   * THE FIRST THING THIS MODULE WRONGLY FLAGGED WAS ITS OWN TEST FILE. Blanking comments is not enough: a
   * specifier's own quotes must stay readable for the regex to bracket them, so a file containing
   * import-shaped TEXT inside a quoted string — a fixture, a generator template, an error message quoting a
   * line of code — reported an edge that does not exist. Run against the real repo it claimed this very file
   * imports `gate-health.mjs`, which it does not.
   *
   * The fix is positional, so it is worth pinning positionally.
   */
  it('import-shaped text INSIDE a string is not an import', () => {
    const src = [
      'const fixture = "import { assessCriteria } from \'../lib/gate-health.mjs\';";',
      "const other = 'export { x } from \"./sneaky.mjs\";';",
      "import { real } from './real.mjs';",
    ].join('\n');
    expect(relativeImportsIn(src)).toEqual(['./real.mjs']);
  });

  it('and the specifier’s own quotes still survive, which is why bodies are not blanked', () => {
    // The regression that the naive fix — blank every string body — would cause: the specifier vanishes too.
    expect(relativeImportsIn("import { x } from './kept.mjs';")).toEqual(['./kept.mjs']);
  });
});

describe('resolving a specifier is pure path arithmetic', () => {
  it('resolves ./ and ../ against the importing file’s directory', () => {
    expect(resolveSpecifier('scripts/operations/gate-health.mjs', '../lib/gate-health.mjs')).toBe('scripts/lib/gate-health.mjs');
    expect(resolveSpecifier('scripts/readiness/a.mjs', './b.mjs')).toBe('scripts/readiness/b.mjs');
    expect(resolveSpecifier('scripts/operations/__tests__/x.test.mjs', '../effect-executor.mjs')).toBe('scripts/operations/effect-executor.mjs');
  });

  it('refuses to climb above the repo root rather than inventing a path', () => {
    expect(resolveSpecifier('a.mjs', '../../outside.mjs')).toBeNull();
  });
});

describe('the index is the import graph, reversed', () => {
  const sources = [
    { file: 'scripts/lib/gate-health.mjs', source: '// no imports' },
    { file: 'scripts/operations/gate-health.mjs', source: "import { assessCriteria } from '../lib/gate-health.mjs';" },
    { file: 'scripts/operations/__tests__/gate-health.test.mjs', source: "import { x } from '../../lib/gate-health.mjs';" },
  ];

  it('maps a target to everyone importing it', () => {
    expect(consumerIndex(sources).get('scripts/lib/gate-health.mjs'))
      .toEqual(['scripts/operations/__tests__/gate-health.test.mjs', 'scripts/operations/gate-health.mjs']);
  });

  it('a self-import is not a consumer edge', () => {
    const index = consumerIndex([{ file: 'scripts/a.mjs', source: "import { x } from './a.mjs';" }]);
    expect(index.get('scripts/a.mjs')).toBeUndefined();
  });

  it('recognises a test file by either convention this repo uses', () => {
    expect(isTestFile('scripts/operations/__tests__/import-graph.mjs')).toBe(true);
    expect(isTestFile('scripts/readiness/x.test.mjs')).toBe(true);
    expect(isTestFile('scripts/readiness/x.mjs')).toBe(false);
  });
});

/**
 * The coverage matcher is IMPORTED from `scope-lease.mjs`, never reimplemented — it is the one the dispatcher
 * decides lane contention with, and a second copy here would drift. These assert the granularity contract
 * holds THROUGH this module, so a future edit that swapped in a naive `startsWith` would redden.
 */
describe('coverage uses the dispatcher’s own granularity rules', () => {
  const index = consumerIndex([
    { file: 'scripts/readiness/consumer.mjs', source: "import { x } from './target.mjs';" },
    { file: 'scripts/other/far.mjs', source: "import { x } from '../readiness/target.mjs';" },
  ]);

  it('a SUBTREE entry covers a file beneath it', () => {
    const rows = scopeConsumerGaps(['we:scripts/readiness/target.mjs', 'we:scripts/readiness/'], index);
    expect(rows[0].uncovered).toEqual(['scripts/other/far.mjs']); // the sibling is covered, the far one is not
  });

  it('a FILE entry does NOT cover its siblings', () => {
    const rows = scopeConsumerGaps(['we:scripts/readiness/target.mjs'], index);
    expect(rows[0].uncovered).toEqual(['scripts/other/far.mjs', 'scripts/readiness/consumer.mjs']);
  });

  it('a scope entry with no importers produces no row at all', () => {
    expect(scopeConsumerGaps(['we:scripts/readiness/nobody-imports-me.mjs'], index)).toEqual([]);
  });

  /**
   * THE TWO CASES THAT DISTINGUISH `coversFile` FROM A NAIVE `startsWith`, and the reason they exist:
   * swapping the import for a hand-rolled prefix test left every OTHER test in this file green. A mutation
   * that survives is a finding even when the code is right, and here the code being right is the whole point
   * — `coversFile` is what `dispatch-plan.mjs` decides lane contention with, so a private copy that agreed
   * on the easy cases and diverged on globs would be invisible until two lanes collided.
   */
  it('a GLOB entry covers by pattern, which a prefix test cannot do', () => {
    const rows = scopeConsumerGaps(['we:scripts/readiness/target.mjs', 'we:scripts/readiness/*.mjs'], index);
    // `consumer.mjs` matches the glob; a prefix test against the literal `…/*.mjs` matches nothing at all.
    expect(rows[0].uncovered).toEqual(['scripts/other/far.mjs']);
  });

  it('a FILE entry is never treated as a prefix — #2679’s "no synthetic subtree"', () => {
    const deep = consumerIndex([
      { file: 'scripts/readiness/target.mjs.bak.mjs', source: "import { x } from './target.mjs';" },
    ]);
    // `startsWith` would call this covered, because the importer's path begins with the entry verbatim.
    expect(scopeConsumerGaps(['we:scripts/readiness/target.mjs'], deep)[0].uncovered)
      .toEqual(['scripts/readiness/target.mjs.bak.mjs']);
  });
});

describe('test importers are noise — unless the scope forgot tests entirely', () => {
  const index = consumerIndex([
    { file: 'scripts/readiness/__tests__/t.test.mjs', source: "import { x } from '../target.mjs';" },
    { file: 'scripts/readiness/real.mjs', source: "import { x } from './target.mjs';" },
  ]);

  it('a suite importing the module it tests is not a finding', () => {
    const out = assessScope(['we:scripts/readiness/target.mjs', 'we:scripts/readiness/__tests__/t.test.mjs'], index);
    expect(out.testsOmitted).toBe(false);
    expect(out.rows[0].uncovered).toEqual(['scripts/readiness/real.mjs']);
  });

  it('but a scope naming NO test file gets told about them', () => {
    const out = assessScope(['we:scripts/readiness/target.mjs'], index);
    expect(out.testsOmitted).toBe(true);
    expect(out.rows[0].uncovered).toEqual(['scripts/readiness/__tests__/t.test.mjs', 'scripts/readiness/real.mjs']);
  });

  it('scopeNamesNoTest reads the scope, not the index', () => {
    expect(scopeNamesNoTest(['we:scripts/a.mjs'])).toBe(true);
    expect(scopeNamesNoTest(['we:scripts/a.mjs', 'we:scripts/__tests__/a.test.mjs'])).toBe(false);
  });
});

describe('an item with nothing to say gets nothing said about it', () => {
  it('an empty or missing scope is not an error — the dispatcher already calls that unshaped', () => {
    const index = consumerIndex([{ file: 'a.mjs', source: "import './b.mjs';" }]);
    for (const scope of [[], null, undefined]) {
      const out = assessScope(scope, index);
      expect(out.rows).toEqual([]);
      expect(out.uncoveredCount).toBe(0);
    }
  });

  it('the blind spots are exported as DATA, so a report can print them', () => {
    expect(BLIND_SPOTS.length).toBeGreaterThanOrEqual(4);
    expect(BLIND_SPOTS.join(' ')).toMatch(/non-literal specifier/);
    expect(BLIND_SPOTS.join(' ')).toMatch(/injection is invisible/);
    // Frozen: a caller must not be able to edit the caveat list it is about to print.
    expect(Object.isFrozen(BLIND_SPOTS)).toBe(true);
  });
});

/**
 * ── THE REPLAYS. THESE ARE WHY THE MODULE EXISTS. ───────────────────────────────────────────────────────────
 *
 * Each reconstructs an item's `scope:` exactly as it was written, over a source index shaped like the real
 * import edges at that time, and asserts the check names the consumer the reviewers had to find by hand. A
 * check that cannot reproduce the failures that motivated it has not earned its place.
 */
describe('replaying the items whose reviews this would have shortened', () => {
  it('#3090 — the caller whose blocker sentence was the real subject was not in scope', () => {
    // The card declared the library and `retry-health.mjs` (which it never touched). Its ONE real consumer,
    // the operation that renders the "why is this blocked" sentence, was absent — and three review rounds
    // were about that sentence, not about the library function.
    const index = consumerIndex([
      { file: 'scripts/operations/gate-health.mjs', source: "import { assessCriteria, SIZE_BANDS } from '../lib/gate-health.mjs';" },
      { file: 'scripts/operations/__tests__/gate-health.test.mjs', source: "import { requiredNPerGroup } from '../../lib/gate-health.mjs';" },
    ]);
    const out = assessScope(['we:scripts/lib/gate-health.mjs', 'we:scripts/operations/retry-health.mjs'], index);
    expect(out.uncoveredCount).toBeGreaterThan(0);
    expect(out.rows.find((r) => r.file === 'we:scripts/lib/gate-health.mjs').uncovered)
      .toContain('scripts/operations/gate-health.mjs');
  });

  it('#3091 — four call sites had to honour one discipline; the card named the discipline once', () => {
    // Reviewers found them one at a time across six rounds. Every one is an importer of the executor.
    const index = consumerIndex([
      { file: 'scripts/operations/cli-adapter.mjs', source: "import { applyPendingEffects } from './effect-executor.mjs';" },
      { file: 'scripts/operations/http-adapter.mjs', source: "import { driveRun } from './cli-adapter.mjs';" },
      { file: 'scripts/operations/wake.mjs', source: "import { applyPendingEffects } from './effect-executor.mjs';" },
      { file: 'scripts/operations/effect-observer.mjs', source: "import { inFlightEntries, resolveInFlight } from './effect-executor.mjs';" },
    ]);
    // The scope as first written — the executor alone.
    const narrow = assessScope(['we:scripts/operations/effect-executor.mjs'], index);
    expect(narrow.rows[0].uncovered).toEqual([
      'scripts/operations/cli-adapter.mjs',
      'scripts/operations/effect-observer.mjs',
      'scripts/operations/wake.mjs',
    ]);
    // Naming those three silences it for the executor — the check is satisfiable, not a permanent nag.
    const widened = assessScope([
      'we:scripts/operations/effect-executor.mjs', 'we:scripts/operations/cli-adapter.mjs',
      'we:scripts/operations/wake.mjs', 'we:scripts/operations/effect-observer.mjs',
    ], index);
    expect(widened.rows.find((r) => r.file === 'we:scripts/operations/effect-executor.mjs')).toBeUndefined();
  });

  it('#3084 — a new vocabulary had to reach hand-backs in files the card never named', () => {
    const index = consumerIndex([
      { file: 'scripts/operations/cli-adapter.mjs', source: "import { inFlightEntries } from './effect-executor.mjs';" },
      { file: 'scripts/operations/review-pr.mjs', source: "import { resolveInFlight } from './effect-executor.mjs';" },
      { file: 'scripts/lib/judge-spawn.mjs', source: "import { OBSERVATIONS } from '../operations/effect-observer.mjs';" },
    ]);
    const out = assessScope(['we:scripts/operations/effect-observer.mjs', 'we:scripts/operations/wake.mjs'], index);
    expect(out.rows.find((r) => r.file === 'we:scripts/operations/effect-observer.mjs').uncovered)
      .toEqual(['scripts/lib/judge-spawn.mjs']);
  });

  // THE HONEST NEGATIVE. #3071's scope was exactly right and the work still failed, because nothing had
  // measured whether it would unblock anything. This check must say NOTHING about it — a checklist that
  // manufactures a hit on every past failure is worthless as a signal.
  it('#3071 — scope was correct, and the check correctly finds nothing', () => {
    const index = consumerIndex([
      { file: 'scripts/operations/gate-health.mjs', source: "import { assessCriteria } from '../lib/gate-health.mjs';" },
    ]);
    const out = assessScope(['we:scripts/lib/gate-health.mjs', 'we:scripts/operations/gate-health.mjs'], index);
    expect(out.uncoveredCount).toBe(0);
  });
});

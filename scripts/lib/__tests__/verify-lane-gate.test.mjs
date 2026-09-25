/**
 * @file scripts/lib/__tests__/verify-lane-gate.test.mjs
 * @description Executable proof for #3372 + #3395: `verify-lane.mjs`'s default gate must invoke the diff-driven
 *   test selection (#2681) instead of an unconditional `npm run test:unit`, AND scope its check:standards half to
 *   `--local --files=<changed>` per #1937 whenever the changed set touches neither `backlog/` nor a gate-self/
 *   policy-core path (#3395) — AND the fail-safe direction must not regress for either half. Tests the pure
 *   decision core (`resolveDefaultGate`/`canScopeCheckStandards`) directly with an injected `runGit`, mirroring
 *   `scripts/readiness/__tests__/test-selection.test.mjs`'s own convention (no real git/npm/vitest IO — fast,
 *   hermetic, and immune to whatever the *current* diff of the repo happens to be). A source-wiring guard at the
 *   bottom pins that `verify-lane.mjs` actually calls this function for its default gate, so the decision core
 *   being correct can never silently drift from what ships.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { resolveDefaultGate, canScopeCheckStandards, composeGate, describeGate, FULL_GATE, MAX_RELATED_TARGETS } from '../verify-lane-gate.mjs';

/** A synthetic git runner for the xpnhz4o working-tree changed set: `merge-base` resolves to a fixed sha;
 *  `diff --name-only <sha>` returns the (working-tree) changed files; `--diff-filter=D` the deleted ones;
 *  `ls-files --others` the untracked ones; `grep -l -F -e <needle>…` the test files naming a needle (exit 1 —
 *  a throw — when none do, exactly as real `git grep`). No real git process. */
function fakeGit(changedFiles, { deleted = [], untracked = [], grepHits = {} } = {}) {
  return (args) => {
    if (args[0] === 'merge-base') return 'deadbeef';
    if (args[0] === 'diff' && args.includes('--diff-filter=D')) return deleted.join('\n');
    if (args[0] === 'diff') {
      expect(args).toEqual(['diff', '--name-only', 'deadbeef']);
      return changedFiles.join('\n');
    }
    if (args[0] === 'ls-files') return untracked.join('\n');
    if (args[0] === 'grep') {
      const needles = args.filter((_, i) => args[i - 1] === '-e');
      const hits = Array.from(new Set(needles.flatMap((n) => grepHits[n] || [])));
      if (!hits.length) throw new Error('git grep: exit 1 (no match)');
      return hits.join('\n');
    }
    throw new Error(`unexpected git invocation in test: ${args.join(' ')}`);
  };
}

describe('resolveDefaultGate (xpnhz4o) — the LOCAL gate runs only the diff-selected tests', () => {
  it('a scripts/ change (the everyday PR) SELECTS: vitest related on it + the tests naming it, never `npm run test:unit`', () => {
    const { command, decision } = resolveDefaultGate({
      runGit: fakeGit(['scripts/verify-lane.mjs'], { grepHits: { 'verify-lane.mjs': ['scripts/__tests__/verify-lane.test.mjs'] } }),
      env: {},
    });
    expect(decision.mode).toBe('shrink');
    expect(decision.referencedTests).toEqual(['scripts/__tests__/verify-lane.test.mjs']);
    expect(command).toBe("npx vitest related 'scripts/__tests__/verify-lane.test.mjs' 'scripts/verify-lane.mjs' --run --passWithNoTests && npm run check:standards -- --local --files='scripts/verify-lane.mjs'");
    expect(command).not.toContain('test:unit');
  });

  it('a docs-only diff selects (and passes with no tests) and scopes check:standards (#1937)', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['docs/readme.md']), env: {} });
    expect(decision.mode).toBe('shrink');
    expect(command).toBe("npx vitest related 'docs/readme.md' --run --passWithNoTests && npm run check:standards -- --local --files='docs/readme.md'");
  });

  it('keys on the WORKING TREE: uncommitted and untracked files are in the selection (a fixer gates before committing)', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['scripts/a.mjs'], { untracked: ['scripts/__tests__/a-new.test.mjs'] }), env: {} });
    expect(decision.mode).toBe('shrink');
    expect(decision.changedFiles).toEqual(['scripts/__tests__/a-new.test.mjs', 'scripts/a.mjs']);
    expect(command).toContain("'scripts/__tests__/a-new.test.mjs' 'scripts/a.mjs'");
  });

  it.each([
    ['package.json'], ['package-lock.json'], ['vitest.config.ts'], ['vitest.setup.ts'], ['vitest.shared.ts'],
    ['tsconfig.json'], ['scripts/__tests__/helpers/fake-gh.mjs'], ['scripts/operations/__tests__/import-graph.mjs'],
  ])('FALLBACK: %s (config / setup / dependency / shared test helper) runs the FULL suite and says why', (file) => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['scripts/a.mjs', file]), env: {} });
    expect(decision.mode).toBe('full');
    expect(decision.triggerFiles).toEqual([file]);
    expect(decision.reasons.join(' ')).toContain(file);
    expect(command.startsWith('npm run test:unit && ')).toBe(true);
  });

  it('FALLBACK: a deleted source file runs the full suite (its importers are unfindable); a deleted TEST file does not', () => {
    const src = resolveDefaultGate({ runGit: fakeGit(['scripts/gone.mjs'], { deleted: ['scripts/gone.mjs'] }), env: {} });
    expect(src.decision.mode).toBe('full');
    expect(src.decision.deletedSourceFiles).toEqual(['scripts/gone.mjs']);
    const test = resolveDefaultGate({ runGit: fakeGit(['scripts/a.mjs', 'scripts/__tests__/gone.test.mjs'], { deleted: ['scripts/__tests__/gone.test.mjs'] }), env: {} });
    expect(test.decision.mode).toBe('shrink');
    expect(test.command.split(' && ')[0]).toBe("npx vitest related 'scripts/a.mjs' --run --passWithNoTests");
  });

  it('PR #2680 review — a diff of ONLY deleted non-source files never emits a target-less `vitest related` (a false red)', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['docs/obsolete.md'], { deleted: ['docs/obsolete.md'] }), env: {} });
    expect(decision.mode).toBe('shrink');
    expect(decision.targets).toEqual([]);
    expect(command).not.toMatch(/vitest related\s+--run/);
    expect(command.split(' && ')[0]).toMatch(/^echo .*vitest half skipped/);
  });

  it('PR #2680 review — reference discovery greps every vitest test suffix (jsx / cts included)', () => {
    let seen = null;
    const git = fakeGit(['scripts/tool.mjs']);
    resolveDefaultGate({ runGit: (args) => { if (args[0] === 'grep') seen = args; return git(args); }, env: {} });
    for (const spec of ['*.test.ts', '*.test.tsx', '*.test.jsx', '*.test.mjs', '*.test.cjs', '*.test.cts']) expect(seen).toContain(spec);
  });

  it('a backlog/ card selects for vitest but keeps check:standards UNSCOPED (the #1937/#3395 margin), and never greps ~140 fixture tests for `backlog`', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['backlog/100-example.md'], { grepHits: { backlog: ['x.test.mjs'] } }), env: {} });
    expect(decision.mode).toBe('shrink');
    expect(decision.referencedTests).toEqual([]);
    expect(command).toBe("npx vitest related 'backlog/100-example.md' --run --passWithNoTests && npm run check:standards");
  });

  it('a change under a glob-discovered root (demos/) adds the tests that name the root', () => {
    const { decision } = resolveDefaultGate({ runGit: fakeGit(['demos/loan/app.ts'], { grepHits: { demos: ['scripts/__tests__/demo-registry.test.mjs'] } }), env: {} });
    expect(decision.referencedTests).toEqual(['scripts/__tests__/demo-registry.test.mjs']);
  });

  it('a gate-self/policy-core path keeps check:standards unscoped (the gate sees the whole-repo signal on a change to itself)', () => {
    const { command } = resolveDefaultGate({ runGit: fakeGit(['scripts/lib/review-escalation.mjs']), env: {} });
    expect(command).toMatch(/--passWithNoTests && npm run check:standards$/);
  });

  it('an explicit opt-out (WE_DIFF_TEST_SELECTION=0) runs the full suite; check:standards still scopes', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(['docs/readme.md']), env: { WE_DIFF_TEST_SELECTION: '0' } });
    expect(decision.mode).toBe('full');
    expect(command).toBe("npm run test:unit && npm run check:standards -- --local --files='docs/readme.md'");
  });

  it('FAIL-SAFE: a git failure (no computable diff) falls back to FULL_GATE, never shrinks or scopes', () => {
    const { command, decision } = resolveDefaultGate({ runGit: () => { throw new Error('no such ref'); }, env: {} });
    expect(decision.mode).toBe('full');
    expect(decision.changedFiles).toBe(null);
    expect(command).toBe(FULL_GATE);
  });

  it('FAIL-SAFE: an empty changed set falls back to FULL_GATE', () => {
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit([]), env: {} });
    expect(decision.mode).toBe('full');
    expect(decision.changedFiles).toEqual([]);
    expect(command).toBe(FULL_GATE);
  });

  it('a diff too large to pass to `vitest related` (over MAX_RELATED_TARGETS) falls back to the full suite and says so', () => {
    const many = Array.from({ length: MAX_RELATED_TARGETS + 1 }, (_, i) => `scripts/m${i}.mjs`);
    const { command, decision } = resolveDefaultGate({ runGit: fakeGit(many), env: {} });
    expect(decision.mode).toBe('full');
    expect(decision.reasons.join(' ')).toMatch(/over 300/);
    expect(command.startsWith('npm run test:unit && ')).toBe(true);
  });

  it('describeGate SAYS which it was: SELECTED with counts, or FULL SUITE (fallback) with the reason', () => {
    const sel = describeGate(resolveDefaultGate({ runGit: fakeGit(['scripts/a.mjs']), env: {} }));
    expect(sel).toMatch(/^verify-lane gate: SELECTED tests only — 1 changed path/);
    expect(sel).toContain('CI still runs the full suite');
    const full = describeGate(resolveDefaultGate({ runGit: fakeGit(['package.json']), env: {} }));
    expect(full).toMatch(/^verify-lane gate: FULL SUITE \(fallback\)/);
    expect(full).toContain('package.json');
    expect(full).toContain('command: npm run test:unit');
  });
});

// #3919 — the gate must only name npm scripts the TARGET checkout has (real package.json script-name sets).
const WE_SCRIPTS = ['test:unit', 'check:standards', 'test', 'build'];
const FRONTIERUI_SCRIPTS = ['dev', 'build', 'test', 'test:unit', 'test:e2e', 'test:coverage', 'check:standards'];
const PLATEAU_APP_SCRIPTS = ['start', 'build', 'preview', 'test', 'check:render-conformance', 'test:e2e', 'explore'];

describe('resolveDefaultGate per-repo scripts (#3919) — only run the npm scripts the checkout actually has', () => {
  const cases = [
    { name: 'shrinkable diff', files: ['docs/readme.md'] },
    { name: 'full + scoped', files: ['package.json'] },
    { name: 'full + unscoped (backlog)', files: ['backlog/100-example.md'] },
    { name: 'empty diff', files: [] },
  ];

  it.each(cases)('a WE checkout ($name) gets the byte-for-byte unchanged command vs. no scripts injected', ({ files }) => {
    const legacy = resolveDefaultGate({ runGit: fakeGit(files), env: {} });
    const we = resolveDefaultGate({ runGit: fakeGit(files), env: {}, scripts: WE_SCRIPTS });
    expect(we.command).toBe(legacy.command);
    expect(we.gateReasons).toEqual([]);
  });

  it('a WE checkout with an empty diff still gets exactly FULL_GATE', () => {
    expect(resolveDefaultGate({ runGit: fakeGit([]), env: {}, scripts: WE_SCRIPTS }).command).toBe(FULL_GATE);
  });

  it.each(cases)('a frontierui checkout ($name) has test:unit + check:standards, so its gate is unchanged too', ({ files }) => {
    const legacy = resolveDefaultGate({ runGit: fakeGit(files), env: {} });
    expect(resolveDefaultGate({ runGit: fakeGit(files), env: {}, scripts: FRONTIERUI_SCRIPTS }).command).toBe(legacy.command);
  });

  it.each(cases)('a plateau-app checkout ($name) runs `npm test` and skips the missing check:standards', ({ files }) => {
    const { command, gateReasons } = resolveDefaultGate({ runGit: fakeGit(files), env: {}, scripts: PLATEAU_APP_SCRIPTS });
    expect(command).toBe('npm test');
    expect(command).not.toContain('test:unit');
    expect(command).not.toContain('check:standards');
    expect(gateReasons.join(' ')).toMatch(/no `test:unit`.*npm test/);
    expect(gateReasons.join(' ')).toMatch(/no `check:standards`/);
  });

  it('a plateau-app checkout with an uncommitted edit also gets `npm test` (the selection is WE-shaped; script-aware)', () => {
    const { command } = resolveDefaultGate({ runGit: fakeGit(['docs/readme.md'], { untracked: ['src/x.ts'] }), env: {}, scripts: PLATEAU_APP_SCRIPTS });
    expect(command).toBe('npm test');
  });

  it('a checkout with check:standards but no test:unit keeps the (scoped) health gate after `npm test`', () => {
    const { command } = resolveDefaultGate({ runGit: fakeGit(['src/a.ts']), env: {}, scripts: ['test', 'check:standards'] });
    expect(command).toBe("npm test && npm run check:standards -- --local --files='src/a.ts'");
  });

  it('a checkout with no test/test:unit/check:standards script skips BOTH halves with an explicit reason, never a missing-script failure', () => {
    const { command, gateReasons } = composeGate({ vitestCmd: 'npm run test:unit', checkStandardsCmd: 'npm run check:standards', scripts: ['build'] });
    expect(command).toMatch(/^echo /);
    expect(command).not.toMatch(/npm (run|test)/);
    expect(gateReasons).toHaveLength(2);
    expect(gateReasons.join(' ')).toMatch(/test half skipped/);
  });
});

describe('canScopeCheckStandards (#3395) — the check:standards-scoping predicate in isolation', () => {
  it('is false for null (unreadable/unknown diff)', () => {
    expect(canScopeCheckStandards(null)).toBe(false);
  });

  it('is false for an empty changed set', () => {
    expect(canScopeCheckStandards([])).toBe(false);
  });

  it('is false when any changed file is under backlog/', () => {
    expect(canScopeCheckStandards(['docs/readme.md', 'backlog/100-example.md'])).toBe(false);
  });

  it('is false when any changed file is a gate-self/policy-core path', () => {
    expect(canScopeCheckStandards(['scripts/lib/review-escalation.mjs'])).toBe(false);
  });

  it('is true for a non-empty changed set touching neither surface, even a blast-radius `scripts/` path outside the policy-core roster', () => {
    expect(canScopeCheckStandards(['scripts/verify-lane.mjs', 'package.json'])).toBe(true);
  });
});

describe('verify-lane.mjs source wiring — the default gate actually calls resolveDefaultGate', () => {
  it('xpnhz4o — prints describeGate before running, and `run` mode records no marker', () => {
    const src = readFileSync(resolve(process.cwd(), 'scripts/verify-lane.mjs'), 'utf8');
    expect(src).toMatch(/process\.stderr\.write\(describeGate\(resolved\)/);
    expect(src).toMatch(/if \(MODE !== 'run'\) writeMarker\(verifyStartBody/);
    expect(src).toMatch(/const preStart = MODE === 'run' \? null : readMarker\(\)/);
  });

  it('imports resolveDefaultGate from ./lib/verify-lane-gate.mjs and uses it to build the default GATE', () => {
    const src = readFileSync(resolve(process.cwd(), 'scripts/verify-lane.mjs'), 'utf8');
    expect(src).toMatch(/from ['"]\.\/lib\/verify-lane-gate\.mjs['"]/);
    expect(src).toMatch(/resolveDefaultGate\(/);
    // The literal bare default must be GONE — only the fallback constant inside verify-lane-gate.mjs keeps it.
    expect(src).not.toMatch(/const GATE = typeof flags\.gate === 'string' \? flags\.gate : 'npm run test:unit/);
  });

  it('#3919 — injects the target checkout\'s package.json script names into resolveDefaultGate', () => {
    const src = readFileSync(resolve(process.cwd(), 'scripts/verify-lane.mjs'), 'utf8');
    expect(src).toMatch(/join\(REPO, 'package\.json'\)/);
    expect(src).toMatch(/resolveDefaultGate\(\{[^}]*scripts: readCheckoutScripts\(\)/);
  });
});

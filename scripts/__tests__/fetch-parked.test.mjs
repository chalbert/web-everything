/**
 * @file fetch-parked.test.mjs — proof of the PURE `assembleParked` + its helpers (#2434). The two `gh` calls
 *   are the I/O boundary (the CLI's concern); the view+diff → contract distillation, the rollup→bucket
 *   normalization, and the review-class read are decided in pure fns and unit-tested against fixtures, no gh.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import {
  assembleParked, rollupToCheckRows, reviewClassFromLabels, labelNames,
  filterToRequired, recoverCheckRows, resolveRequiredNames,
  scopeFilesToNet, resolveNetDiff, sameCommit,
} from '../fetch-parked.mjs';
import { classifyChecks } from '../pr-land.mjs';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// A real-shaped `gh pr view … --json statusCheckRollup` — CheckRun rows carry status/conclusion, not bucket.
const greenRollup = [
  { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'CheckRun', name: 'smoke', status: 'COMPLETED', conclusion: 'SUCCESS' },
  { __typename: 'CheckRun', name: 'visual', status: 'COMPLETED', conclusion: 'SKIPPED' },
];
const pendingRollup = [
  { __typename: 'CheckRun', name: 'test', status: 'IN_PROGRESS', conclusion: null },
];
const failedRollup = [
  { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'FAILURE' },
];

describe('rollupToCheckRows — normalizes the GraphQL rollup to gh bucket rows', () => {
  it('maps COMPLETED conclusions to pass/skipping buckets', () => {
    expect(rollupToCheckRows(greenRollup)).toEqual([
      { name: 'test', bucket: 'pass' },
      { name: 'smoke', bucket: 'pass' },
      { name: 'visual', bucket: 'skipping' },
    ]);
  });

  it('maps an in-flight status to pending regardless of a null conclusion', () => {
    expect(rollupToCheckRows(pendingRollup)).toEqual([{ name: 'test', bucket: 'pending' }]);
  });

  it('maps a FAILURE conclusion to fail', () => {
    expect(rollupToCheckRows(failedRollup)).toEqual([{ name: 'test', bucket: 'fail' }]);
  });

  it('reads a StatusContext (state, no status/conclusion)', () => {
    expect(rollupToCheckRows([{ __typename: 'StatusContext', context: 'ci/x', state: 'FAILURE' }]))
      .toEqual([{ name: 'ci/x', bucket: 'fail' }]);
  });

  it('is tolerant of an absent/odd rollup', () => {
    expect(rollupToCheckRows(undefined)).toEqual([]);
    expect(rollupToCheckRows(null)).toEqual([]);
  });

  it('feeds classifyChecks correctly — the whole point (green→passed, pending→pending, fail→failed)', () => {
    expect(classifyChecks(rollupToCheckRows(greenRollup)).status).toBe('passed');
    expect(classifyChecks(rollupToCheckRows(pendingRollup)).status).toBe('pending');
    expect(classifyChecks(rollupToCheckRows(failedRollup)).status).toBe('failed');
  });
});

describe('filterToRequired — narrows rows to the required set (#2482)', () => {
  const rows = [
    { name: 'test', bucket: 'pass' },
    { name: 'lint', bucket: 'fail' },
    { name: 'smoke', bucket: 'pending' },
  ];

  it('keeps only rows whose name is in requiredNames', () => {
    expect(filterToRequired(rows, ['test'])).toEqual([{ name: 'test', bucket: 'pass' }]);
  });

  it('an empty requiredNames yields [] (a no-required-checks PR → classifyChecks passed)', () => {
    expect(filterToRequired(rows, [])).toEqual([]);
    expect(classifyChecks(filterToRequired(rows, [])).status).toBe('passed');
  });

  it('a non-array requiredNames (unknown set) keeps ALL rows — the historical all-checks fallback', () => {
    expect(filterToRequired(rows, undefined)).toEqual(rows);
    expect(filterToRequired(rows, null)).toEqual(rows);
  });

  it('is tolerant of a non-array rows arg', () => {
    expect(filterToRequired(undefined, ['test'])).toEqual([]);
  });

  it('a required name absent from the rollup drops to [] → passed (same reconciliation pr-land makes)', () => {
    // The required `test` check has not reported into the rollup yet — filtering yields [], which classifies as
    // passed. This mirrors what `gh pr checks --required` returns to pr-land for the same PR, so the two agree.
    expect(filterToRequired([{ name: 'other', bucket: 'pass' }], ['test'])).toEqual([]);
    expect(classifyChecks(filterToRequired([{ name: 'other', bucket: 'pass' }], ['test'])).status).toBe('passed');
  });

  it('the point: required green + optional red reads as passed, not failed', () => {
    const mixed = [{ name: 'test', bucket: 'pass' }, { name: 'optional', bucket: 'fail' }];
    expect(classifyChecks(filterToRequired(mixed, ['test'])).status).toBe('passed');
    expect(classifyChecks(mixed).status).toBe('failed'); // the all-checks over-report we are fixing
  });
});

describe('recoverCheckRows — reads a non-zero `gh pr checks` result (#2482)', () => {
  it('recovers the JSON rows gh prints to stdout in the pending/failed case', () => {
    const rows = [{ name: 'test', state: 'IN_PROGRESS', bucket: 'pending' }];
    expect(recoverCheckRows({ stdout: JSON.stringify(rows) })).toEqual({ rows });
  });

  it('reads the genuine no-required-checks case (stderr "no checks reported") as []', () => {
    expect(recoverCheckRows({ stderr: 'no checks reported on the main branch' })).toEqual({ rows: [] });
    // …and that empty array classifies as passed — the exit-0 behaviour finding 3 wants.
    expect(classifyChecks(recoverCheckRows({ stderr: 'no checks reported' }).rows).status).toBe('passed');
  });

  it('matches "no checks reported" on the message too (not just stderr)', () => {
    expect(recoverCheckRows({ message: 'Command failed … no checks reported' })).toEqual({ rows: [] });
  });

  it('treats a real gh/network error as unknown (caller keeps waiting / falls back)', () => {
    expect(recoverCheckRows({ stderr: 'HTTP 503: server error' })).toEqual({ unknown: true });
    expect(recoverCheckRows({})).toEqual({ unknown: true });
  });

  it('non-JSON stdout that is not a no-checks message is unknown', () => {
    expect(recoverCheckRows({ stdout: 'garbage' })).toEqual({ unknown: true });
  });
});

describe('resolveRequiredNames — via an injected gh runner (#2482)', () => {
  it('maps the required rows to their names', () => {
    const runGh = () => JSON.stringify([{ name: 'test' }, { name: 'build' }]);
    expect(resolveRequiredNames(runGh, 472)).toEqual(['test', 'build']);
  });

  it('a no-required-checks PR (gh throws with the message) → []', () => {
    const runGh = () => { throw Object.assign(new Error('boom'), { stderr: 'no checks reported' }); };
    expect(resolveRequiredNames(runGh, 472)).toEqual([]);
  });

  it('recovers names from stdout when gh exits non-zero but printed rows', () => {
    const runGh = () => { throw Object.assign(new Error('boom'), { stdout: JSON.stringify([{ name: 'test' }]) }); };
    expect(resolveRequiredNames(runGh, 472)).toEqual(['test']);
  });

  it('a transient gh error → undefined (caller falls back to all-checks)', () => {
    const runGh = () => { throw Object.assign(new Error('boom'), { stderr: 'HTTP 503' }); };
    expect(resolveRequiredNames(runGh, 472)).toBeUndefined();
  });
});

describe('reviewClassFromLabels — reuses the ratified REVIEW_LABELS', () => {
  it('human wins over pending', () => {
    expect(reviewClassFromLabels(['review:human', 'review:pending'])).toBe('human');
  });
  it('pending when only pending is present', () => {
    expect(reviewClassFromLabels(['review:pending', 'ready-to-merge'])).toBe('pending');
  });
  it('none when no review label is present', () => {
    expect(reviewClassFromLabels(['ready-to-merge'])).toBe('none');
  });
});

describe('labelNames — normalizes {name}/string label shapes', () => {
  it('maps object and string labels to names, dropping empties', () => {
    expect(labelNames([{ name: 'a' }, 'b', null, {}])).toEqual(['a', 'b']);
  });
  it('is tolerant of a non-array', () => {
    expect(labelNames(undefined)).toEqual([]);
  });
});

describe('assembleParked — the per-PR bundle contract', () => {
  const view = {
    number: 472,
    title: 'scripts: drain helpers',
    body: 'the body',
    files: [{ path: 'scripts/fetch-parked.mjs', additions: 100, deletions: 0 }],
    state: 'OPEN',
    statusCheckRollup: greenRollup,
    labels: [{ name: 'ready-to-merge' }, { name: 'review:pending' }],
    headRefName: 'lane/2434-drain-helpers',
    mergeable: 'MERGEABLE',
  };
  const d = assembleParked({ view, diff: 'diff --git a/x b/x\n+hi' });

  it('carries the full contract shape', () => {
    expect(d.number).toBe(472);
    expect(d.title).toBe('scripts: drain helpers');
    expect(d.body).toBe('the body');
    expect(d.files).toEqual([{ path: 'scripts/fetch-parked.mjs', additions: 100, deletions: 0 }]);
    expect(d.state).toBe('OPEN');
    expect(d.headRefName).toBe('lane/2434-drain-helpers');
    expect(d.mergeable).toBe('MERGEABLE');
    expect(d.diff).toBe('diff --git a/x b/x\n+hi');
  });

  it('checks come from classifyChecks over the normalized rollup', () => {
    expect(d.checks.status).toBe('passed');
  });

  it('defaults checksScope to "all" when no requiredNames is supplied', () => {
    expect(d.checksScope).toBe('all');
  });

  it('narrows checks to the required set + marks checksScope when requiredNames is supplied (#2482)', () => {
    const mixed = {
      ...view,
      statusCheckRollup: [
        { __typename: 'CheckRun', name: 'test', status: 'COMPLETED', conclusion: 'SUCCESS' },
        { __typename: 'CheckRun', name: 'optional', status: 'COMPLETED', conclusion: 'FAILURE' },
      ],
    };
    const narrowed = assembleParked({ view: mixed, requiredNames: ['test'] });
    expect(narrowed.checks.status).toBe('passed');   // required green — over-report of the optional red is gone
    expect(narrowed.checksScope).toBe('required');
    // …whereas with no requiredNames the same PR over-reports the optional red.
    expect(assembleParked({ view: mixed }).checks.status).toBe('failed');
  });

  it('carries label names + the derived review class', () => {
    expect(d.labels).toEqual(['ready-to-merge', 'review:pending']);
    expect(d.reviewClass).toBe('pending');
  });
});

describe('assembleParked — tolerance of missing fields', () => {
  it('an empty view degrades to the empty contract, never throws', () => {
    const d = assembleParked({ view: {} });
    expect(d.number).toBe(0);
    expect(d.title).toBe('');
    expect(d.files).toEqual([]);
    expect(d.labels).toEqual([]);
    expect(d.reviewClass).toBe('none');
    expect(d.diff).toBe('');
    // no rollup → classifyChecks' no-checks default is "passed"
    expect(d.checks.status).toBe('passed');
    expect(d.checksScope).toBe('all');
  });

  it('a missing arg object does not throw', () => {
    expect(() => assembleParked()).not.toThrow();
  });
});

describe('#2901 — diffBasis: the bundle must say WHICH diff it is carrying', () => {
  // PR #1031 review, finding 5: the first cut guarded this field only with source-text greps in another file —
  // which pass on a file whose net-diff call is commented out, and fail on a behaviour-preserving rename. These
  // are behavioural, on the exported pure assembler, in the module's own canonical suite.
  const view = { number: 7, title: 't', body: '', files: [], state: 'OPEN', labels: [], headRefName: 'lane/x', mergeable: 'MERGEABLE' };

  it("reports 'net' only when the caller states it", () => {
    expect(assembleParked({ view, diff: 'd', diffBasis: 'net' }).diffBasis).toBe('net');
  });

  it("DEFAULTS to the degraded label — an unstated basis must never read as net", () => {
    // The whole point of the field: a degraded basis that looks identical to a good one is how a confident,
    // well-argued, wrong finding reaches a PR author (observed on PR #1018).
    expect(assembleParked({ view, diff: 'd' }).diffBasis).toBe('three-dot');
    expect(assembleParked({ view, diff: 'd', diffBasis: undefined }).diffBasis).toBe('three-dot');
    expect(assembleParked({ view, diff: 'd', diffBasis: null }).diffBasis).toBe('three-dot');
  });

  it('treats any unrecognised value as degraded, never as net', () => {
    for (const v of ['NET', 'net ', 'true', true, 1, {}, [], 'two-dot']) {
      expect(assembleParked({ view, diff: 'd', diffBasis: v }).diffBasis, `basis=${JSON.stringify(v)}`).toBe('three-dot');
    }
  });

  it('is present on every bundle, so a consumer can always ask', () => {
    expect(assembleParked({ view })).toHaveProperty('diffBasis');
    expect(assembleParked({})).toHaveProperty('diffBasis', 'three-dot');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// PR #1031 review, finding 4 — the DECISION is now testable, not just its default.
// The earlier repair asserted `assembleParked`'s one-line `diffBasis` ternary while everything that DECIDES the
// value lived inline in the unexported `runCli()`: the fetch-proof, the path parse, the fail-open rule, the
// scoped view. ~55 lines with no reachable assertion, explained by ~25 lines of comment doing a 3-line
// assertion's job. Those two decisions are now `scopeFilesToNet` (pure) and `resolveNetDiff` (exec-injected).
// ─────────────────────────────────────────────────────────────────────────────

describe('sameCommit — fail-closed object-name identity', () => {
  it('matches on the common prefix, both directions', () => {
    expect(sameCommit('a1b2c3d', 'a1b2c3d4e5f6789')).toBe(true);
    expect(sameCommit('a1b2c3d4e5f6789', 'a1b2c3d')).toBe(true);
    expect(sameCommit('A1B2C3D', ' a1b2c3d ')).toBe(true);
  });
  it('is false on a mismatch, and on anything it cannot verify', () => {
    expect(sameCommit('a1b2c3d', 'b2c3d4e')).toBe(false);
    for (const v of [null, undefined, '', '  ', 'abc', 'not-a-sha', 'abc123g', 123, {}]) {
      expect(sameCommit(v, 'a1b2c3d4'), `left=${JSON.stringify(v)}`).toBe(false);
      expect(sameCommit('a1b2c3d4', v), `right=${JSON.stringify(v)}`).toBe(false);
    }
  });
});

describe('scopeFilesToNet — the file list rides the diff\'s basis, or refuses to', () => {
  const f = (...paths) => paths.map((path) => ({ path }));

  it('narrows the gh list to the net set when gh contains every net path', () => {
    const r = scopeFilesToNet({ ghFiles: f('a.ts', 'b.ts', 'sibling.md'), netPaths: ['a.ts', 'b.ts'] });
    expect(r.scoped).toBe(true);
    expect(r.files.map((x) => x.path)).toEqual(['a.ts', 'b.ts']);
  });

  it('reads `filename` as well as `path` (gh spells it both ways)', () => {
    const r = scopeFilesToNet({ ghFiles: [{ filename: 'a.ts' }, { filename: 'z.md' }], netPaths: ['a.ts'] });
    expect(r.scoped).toBe(true);
    expect(r.files).toEqual([{ filename: 'a.ts' }]);
  });

  it('FAILS OPEN when a net path is missing from the gh list — the sources disagree', () => {
    // The dangerous direction: scoping here would present a SHORT list as authoritative, telling a reviewer a
    // real file is absent from the PR. Keep everything and let the caller drop the `net` claim.
    const gh = f('a.ts', 'sibling.md');
    const r = scopeFilesToNet({ ghFiles: gh, netPaths: ['a.ts', 'renamed.ts'] });
    expect(r.scoped).toBe(false);
    expect(r.files).toBe(gh);
  });

  it('refuses on an empty or absent net list rather than scoping to nothing', () => {
    const gh = f('a.ts');
    for (const netPaths of [[], null, undefined]) {
      const r = scopeFilesToNet({ ghFiles: gh, netPaths });
      expect(r.scoped).toBe(false);
      expect(r.files).toBe(gh);
    }
  });
});

describe('resolveNetDiff — a `net` basis is CLAIMED only when it is PROVEN', () => {
  const OID = 'a2a99afb73cde5f2d1c1be09a15d10e3b7083885';
  // A fake git that answers the shape resolveNetDiff drives. `overrides` swap in one behaviour at a time.
  function fakeExec({ fetchThrows = false, refAt = OID, diffText = 'diff --git a/a.ts b/a.ts\n+x\n', names = 'a.ts\0b.ts\0' } = {}) {
    const calls = [];
    return {
      calls,
      exec: (cmd, args) => {
        calls.push([cmd, ...args].join(' '));
        const a = args.join(' ');
        if (a.startsWith('fetch')) { if (fetchThrows) throw new Error('transport failed'); return ''; }
        if (a.startsWith('rev-parse --verify --end-of-options refs/remotes/origin/')) { if (refAt === null) throw new Error('unknown revision'); return `${refAt}\n`; }
        // A fake CANNOT prove the real argv is right — the real-git block below is what covers that. This arm
        // only keeps the fake honest about WHICH form the code asks for, so an argv change shows up here too.
        if (a.startsWith('rev-parse --end-of-options')) throw new Error('fake: unguarded rev-parse form is not the one under test');
        if (a.includes('--name-only')) return names;
        if (a.startsWith('rev-parse')) return `${OID}\n`;          // resolveNetDiffBasis' own probes
        if (a.startsWith('merge-base')) return `${OID}\n`;
        if (a.startsWith('diff')) return diffText;
        return '';
      },
    };
  }

  it('claims `net` and returns text + plain paths on the happy path', () => {
    const { exec } = fakeExec();
    const r = resolveNetDiff({ exec, headRef: 'lane/x', headRefOid: OID });
    expect(r.basis).toBe('net');
    expect(r.text).toContain('diff --git');
    expect(r.paths).toEqual(['a.ts', 'b.ts']);
  });

  it('guards EVERY caller-supplied argv position with --end-of-options', () => {
    // `headRef` comes from the gh API, and `git check-ref-format 'refs/heads/--output=/tmp/pwn'` exits 0 — so a
    // dash-leading refname is legal and would otherwise be parsed as an option (`--upload-pack=<script>` runs).
    const { exec, calls } = fakeExec();
    resolveNetDiff({ exec, headRef: 'lane/x', headRefOid: OID });
    const fetches = calls.filter((c) => c.startsWith('git fetch'));
    expect(fetches.length).toBeGreaterThan(0);
    for (const c of fetches) {
      expect(c, `unguarded fetch argv: ${c}`).toContain('--end-of-options');
      expect(c.indexOf('--end-of-options'), 'the guard must PRECEDE the ref').toBeLessThan(c.indexOf('lane/x'));
    }
  });

  it('degrades when the fetch fails — a swallowed transport error must not yield a `net` label', () => {
    const { exec } = fakeExec({ fetchThrows: true });
    expect(resolveNetDiff({ exec, headRef: 'lane/x', headRefOid: OID })).toEqual({ text: '', paths: [], basis: 'three-dot' });
  });

  it('degrades when the fetched ref is NOT the head gh reported — exit 0 is not currency', () => {
    // A clone with a narrowed refspec returns 0 from `git fetch origin lane/x` while never creating the ref, so
    // the basis would silently resolve against a stale local branch: the panel signs off commit A at head B.
    const { exec } = fakeExec({ refAt: 'ffffffffffffffffffffffffffffffffffffffff' });
    expect(resolveNetDiff({ exec, headRef: 'lane/x', headRefOid: OID }).basis).toBe('three-dot');
    const missing = fakeExec({ refAt: null });
    expect(resolveNetDiff({ exec: missing.exec, headRef: 'lane/x', headRefOid: OID }).basis).toBe('three-dot');
  });

  it('degrades when there is no oid to prove currency AGAINST', () => {
    const { exec } = fakeExec();
    for (const oid of [undefined, '', null, 'not-a-sha']) {
      expect(resolveNetDiff({ exec, headRef: 'lane/x', headRefOid: oid }).basis, `oid=${JSON.stringify(oid)}`).toBe('three-dot');
    }
  });

  it('degrades on an empty diff or an empty path list rather than claiming an unusable net basis', () => {
    expect(resolveNetDiff({ exec: fakeExec({ diffText: '' }).exec, headRef: 'lane/x', headRefOid: OID }).basis).toBe('three-dot');
    expect(resolveNetDiff({ exec: fakeExec({ names: '' }).exec, headRef: 'lane/x', headRefOid: OID }).basis).toBe('three-dot');
  });

  it('degrades with no headRef and no exec at all', () => {
    expect(resolveNetDiff({ exec: fakeExec().exec, headRef: '' }).basis).toBe('three-dot');
    expect(resolveNetDiff({ headRef: 'lane/x', headRefOid: OID }).basis).toBe('three-dot');
    expect(resolveNetDiff().basis).toBe('three-dot');
  });

  it('does NOT pass --no-renames — with it, every rename-carrying PR degrades', () => {
    // git WITHOUT --no-renames reports only the new path for a rename, which is exactly what `gh` reports. WITH
    // it, git reports old AND new, gh has no previous-path field, so scopeFilesToNet loses an entry and fails
    // open on every rename. Dropping the flag makes renames work instead of degrade.
    const { exec, calls } = fakeExec();
    resolveNetDiff({ exec, headRef: 'lane/x', headRefOid: OID });
    for (const c of calls.filter((x) => x.includes('--name-only'))) {
      expect(c, `--no-renames re-introduced: ${c}`).not.toContain('--no-renames');
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// REAL GIT — the case the fakes structurally cannot cover.
//
// The third #1031 review found `resolveNetDiff` returning `degraded` on EVERY real invocation: plain
// `git rev-parse --end-of-options <ref>` ECHOES the guard as an output line, so the sha never parsed. Twenty
// fake-driven cases passed over a dead path, because the fake answered that command with the bare sha — it
// encoded what git was ASSUMED to do, not what git does. No amount of additional fake coverage catches that
// class; only running the real binary does. So this block spawns real git in a throwaway repo under tmpdir and
// asserts the ONE thing the fakes cannot: that the net basis actually engages end-to-end.
// ─────────────────────────────────────────────────────────────────────────────
describe('resolveNetDiff against REAL git (the fake-vs-reality guard)', () => {

  let dir; let clone; let headOid;

  beforeAll(() => {
    dir = mkdtempSync(join(tmpdir(), 'fetch-parked-realgit-'));
    const up = join(dir, 'up');
    const git = (cwd, ...args) => String(execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) || '').trim();
    execFileSync('git', ['init', '-q', '--initial-branch=main', up], { stdio: 'ignore' });
    git(up, 'config', 'user.email', 'a@b.c');
    git(up, 'config', 'user.name', 'test');
    writeFileSync(join(up, 'README.md'), 'base\n');
    git(up, 'add', 'README.md');
    git(up, 'commit', '-qm', 'base');
    // A head ref that is AHEAD of main by one commit, created without ever switching branches.
    const baseOid = git(up, 'rev-parse', 'HEAD');
    writeFileSync(join(up, 'feature.txt'), 'new\n');
    git(up, 'add', 'feature.txt');
    const tree = git(up, 'write-tree');
    headOid = git(up, 'commit-tree', tree, '-p', baseOid, '-m', 'feature');
    git(up, 'update-ref', 'refs/heads/lane/x', headOid);
    git(up, 'reset', '-q', '--hard', baseOid); // main stays at base; lane/x is the PR head
    clone = join(dir, 'down');
    execFileSync('git', ['clone', '-q', up, clone], { stdio: 'ignore' });
  });

  afterAll(() => { if (dir) rmSync(dir, { recursive: true, force: true }); });

  const realExec = () => (c, a, o) => execFileSync(c, a, { cwd: clone, maxBuffer: 64 * 1024 * 1024, ...o });

  it('ENGAGES the net basis — the assertion that was dead for a whole review round', () => {
    const r = resolveNetDiff({ exec: realExec(), headRef: 'lane/x', headRefOid: headOid });
    expect(r.basis, 'the net basis never engaged against real git').toBe('net');
    expect(r.paths).toEqual(['feature.txt']);
    expect(r.text).toContain('feature.txt');
  });

  it('rev-parse returns a BARE sha under --verify (plain --end-of-options echoes the guard)', () => {
    // Pin the exact git behaviour the bug turned on, so a future edit back to the un-verified form fails here.
    const exec = realExec();
    const verified = String(exec('git', ['rev-parse', '--verify', '--end-of-options', 'refs/remotes/origin/lane/x'], { encoding: 'utf8' })).trim();
    expect(verified).toMatch(/^[0-9a-f]{40}$/);
    const echoed = String(exec('git', ['rev-parse', '--end-of-options', 'refs/remotes/origin/lane/x'], { encoding: 'utf8' })).trim();
    expect(echoed.split('\n')[0], 'git no longer echoes the guard — the workaround may be removable').toBe('--end-of-options');
  });

  it('still REFUSES an option-shaped ref, so --verify did not weaken the guard', () => {
    const exec = realExec();
    expect(() => exec('git', ['rev-parse', '--verify', '--end-of-options', 'refs/remotes/origin/--output=/tmp/pwn'], { encoding: 'utf8' })).toThrow();
  });

  it('degrades against a real repo when the head moved under it (currency, not just resolvability)', () => {
    const other = 'ffffffffffffffffffffffffffffffffffffffff';
    expect(resolveNetDiff({ exec: realExec(), headRef: 'lane/x', headRefOid: other }).basis).toBe('three-dot');
  });
});

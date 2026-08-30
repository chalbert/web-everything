/**
 * @file scripts/__tests__/check-standards-rules-lock-point-and-exports.test.mjs
 * @description Split from check-standards-rules.test.mjs (#3383 test-speedup): the #2678 lock-point
 * composite (code-line count, the `@cohesive` escape hatch, scope-collision counting, findLockPointFiles
 * incl. its real-backlog calibration guard), the #2967a test-only-export scan, and the #2967b unfenced-
 * mandate-param scan (incl. its shipped-wiring guard). Pure file-move — same tests, smaller file.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, readdirSync, mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  countCodeLines, hasCohesiveEscapeHatch, countScopeCollisions, findLockPointFiles,
  lockPointCandidatePaths,
  findTestOnlyExports, extractExportedNames, hasTestOnlyExportOkMarker, TEST_ONLY_EXPORT_ENFORCED,
  findUnfencedMandateParams, UNFENCED_MANDATE_ENFORCED, MANDATE_FENCE_ALLOWED_PARAMS,
} from '../check-standards-rules.mjs';
import { scanUnfencedMandateParams, readMandateBuilderModules } from '../lib/mandate-fence-scan.mjs';
import { require, ROOT } from './fixtures/check-standards-rules-fixtures.mjs';

describe('countCodeLines — size half of the #2678 size+collision composite', () => {
  it('counts non-blank, non-"//"-comment lines', () => {
    const text = ['const a = 1;', '', '// a comment', '  ', 'const b = 2;'].join('\n');
    expect(countCodeLines(text)).toBe(2);
  });
  it('is 0 for an empty file', () => {
    expect(countCodeLines('')).toBe(0);
  });
});

describe('hasCohesiveEscapeHatch — #2678 `// @cohesive: <reason>` marker', () => {
  it('true when a reason follows the marker', () => {
    expect(hasCohesiveEscapeHatch('// @cohesive: single responsibility, just long\nconst a = 1;')).toBe(true);
  });
  it('false when the marker has no reason text', () => {
    expect(hasCohesiveEscapeHatch('// @cohesive:\nconst a = 1;')).toBe(false);
  });
  it('false when absent', () => {
    expect(hasCohesiveEscapeHatch('const a = 1;')).toBe(false);
  });

  // #2782 review — the self-exemption regression. The first cut matched the marker ANYWHERE in the body, so
  // every file that merely DOCUMENTS the escape hatch silenced the gate for itself — including all three
  // files this rule ships in (the rule's doc comment, the warn string that teaches the syntax, and this test
  // file). A 2,200-line rules module is precisely the lock point the gate exists to surface.
  it('a PROSE MENTION does not exempt a file — the marker must be its own comment line', () => {
    // a JSDoc line describing the hatch (the exact shape in this rule's own header)
    expect(hasCohesiveEscapeHatch(' * An in-file `// @cohesive: <reason>` escape hatch silences the warn.\n')).toBe(false);
    // the warn message string that tells authors how to use it
    expect(hasCohesiveEscapeHatch('  `silence this warn with an in-file \\`// @cohesive: <reason>\\` comment.`\n')).toBe(false);
    // a mention mid-line, after real code
    expect(hasCohesiveEscapeHatch('const help = "pass // @cohesive: reason";\n')).toBe(false);
  });

  it('a REAL directive in the file header still exempts', () => {
    expect(hasCohesiveEscapeHatch('// @cohesive: one grammar, splitting scatters it\nconst a = 1;')).toBe(true);
    // after a shebang, blank lines and a leading block comment — still the header
    expect(hasCohesiveEscapeHatch(
      '#!/usr/bin/env node\n/**\n * doc block\n */\n\n// @cohesive: one grammar\nimport x from "y";\n',
    )).toBe(true);
  });

  // #2782 review r2 — the marker is POSITIONAL, not lexical. r1 anchored it to line-start, which still let
  // any incidental line SMUGGLE the directive in as data and permanently silence the gate for a whole file.
  // These three shapes were the ones demonstrated on the real repo; each must stay `false`.
  it('cannot be smuggled in as DATA — template literal, block comment, or fenced markdown example', () => {
    // (a) inside a template literal, past the first line of real content
    expect(hasCohesiveEscapeHatch(
      'const a = 1;\nconst help = `\n// @cohesive: smuggled through a template literal\n`;\n',
    )).toBe(false);
    // (b) inside a `/* … */` block comment — even a LEADING one, where the header region still runs
    expect(hasCohesiveEscapeHatch(
      '/*\n// @cohesive: smuggled inside a block comment\n*/\nconst a = 1;\n',
    )).toBe(false);
    // (c) inside a fenced ```js example in a .md file — a doc that teaches the hatch must not use it
    expect(hasCohesiveEscapeHatch(
      '# Small-file preference\n\nSilence it like so:\n\n```js\n// @cohesive: a documented example\n```\n',
    )).toBe(false);
  });

  it('a directive BELOW the header does not exempt — the header region ends at the first real line', () => {
    expect(hasCohesiveEscapeHatch('import x from "y";\n\n// @cohesive: too late, this is mid-file\n')).toBe(false);
  });

  // The three files this rule ships in are large and contended; none may exempt itself. The original
  // 2793-line check-standards-rules.test.mjs was split across several files (#3383 test-speedup); this
  // file — the one this very describe block now lives in — is its heir for this guard's purposes.
  it('the rule\'s own three files are NOT self-exempt', () => {
    for (const rel of [
      'scripts/check-standards-rules.mjs',
      'scripts/check-standards.mjs',
      'scripts/__tests__/check-standards-rules-lock-point-and-exports.test.mjs',
    ]) expect([rel, hasCohesiveEscapeHatch(readFileSync(join(ROOT, rel), 'utf8'))]).toEqual([rel, false]);
  });
});

describe('countScopeCollisions — queued items naming a file in scope: (#2678)', () => {
  it('counts items whose scope covers the file, via the scope-lease coversFile matcher', () => {
    const backlogScopes = [
      ['we:scripts/foo.mjs'],
      ['we:scripts/'], // subtree entry covers foo.mjs too
      ['we:scripts/bar.mjs'], // does not cover
      ['fui:scripts/foo.mjs'], // different repo — does not cover
    ];
    expect(countScopeCollisions('we:scripts/foo.mjs', backlogScopes)).toBe(2);
  });
  it('0 when no scope lists are given', () => {
    expect(countScopeCollisions('we:scripts/foo.mjs', [])).toBe(0);
  });
});

describe('findLockPointFiles — the #2678 Fork 1(b) soft-warn composite (flagged/quiet cases)', () => {
  const bigCode = Array.from({ length: 900 }, (_, i) => `const x${i} = ${i};`).join('\n');
  // 6 items all naming the same file → collisions = 6, over the default threshold of 5.
  const hotScopes = Array.from({ length: 6 }, () => ['we:scripts/hot.mjs']);

  it('flags a file that is BOTH large and scope-collision-heavy', () => {
    const out = findLockPointFiles({ files: [{ path: 'we:scripts/hot.mjs', text: bigCode }], backlogScopes: hotScopes });
    expect(out).toEqual([{ path: 'we:scripts/hot.mjs', codeLines: 900, collisions: 6 }]);
  });
  it('quiet when the file carries the @cohesive escape hatch, even if large + contended', () => {
    const text = `// @cohesive: single responsibility, deliberately large\n${bigCode}`;
    const out = findLockPointFiles({ files: [{ path: 'we:scripts/hot.mjs', text }], backlogScopes: hotScopes });
    expect(out).toEqual([]);
  });
  it('quiet when large but uncontended (collisions under threshold)', () => {
    const out = findLockPointFiles({
      files: [{ path: 'we:scripts/hot.mjs', text: bigCode }],
      backlogScopes: [['we:scripts/hot.mjs']], // only 1 collision
    });
    expect(out).toEqual([]);
  });
  it('quiet when small, even if heavily contended', () => {
    const out = findLockPointFiles({
      files: [{ path: 'we:scripts/hot.mjs', text: 'const a = 1;\nconst b = 2;' }],
      backlogScopes: hotScopes,
    });
    expect(out).toEqual([]);
  });
  it('respects opts overrides for the two thresholds', () => {
    const out = findLockPointFiles(
      { files: [{ path: 'we:scripts/hot.mjs', text: 'const a = 1;\nconst b = 2;' }], backlogScopes: [['we:scripts/hot.mjs'], ['we:scripts/hot.mjs']] },
      { codeLinesThreshold: 1, collisionsThreshold: 2 },
    );
    expect(out).toEqual([{ path: 'we:scripts/hot.mjs', codeLines: 2, collisions: 2 }]);
  });
});

// #2782 review — CALIBRATION guard. Every case above asserts on SYNTHETIC fixtures, so nothing in the suite
// could fail when the answer over the real repo is "flags nothing". The ratified thresholds (800 code lines
// / 5 collisions) were measured over one population; the live wiring narrows that population to NON-RESOLVED
// items. If the two ever drift apart again — thresholds re-tuned, the status filter widened or narrowed, the
// candidate selection changed — the gate goes silently inert and the throughput debt it exists to expose
// stops printing, which is exactly the "guideline-only" outcome #2678 Fork 1 rejected. This runs the real
// rule over the REAL backlog and pins that it still trips, so that drift is a red test, not a silent no-op.
describe('findLockPointFiles — calibration against the REAL repo backlog (#2782)', () => {
  // #2678's own named targets. At least one must still be flagged; if a genuine split takes the last one
  // off this list, re-measure the thresholds against the narrowed population and update the baseline —
  // do not simply delete the assertion.
  const NAMED_TARGETS_2678 = ['we:scripts/merge-ai-prs.mjs', 'we:scripts/lib/review-core.mjs'];

  const liveLockPoints = () => {
    const loadBacklog = require(join(ROOT, 'src/_data/backlog.js'));
    const backlog = typeof loadBacklog === 'function' ? loadBacklog() : loadBacklog;
    // Same status filter + same candidate selection the live wiring in check-standards.mjs uses.
    const backlogScopes = backlog.filter((it) => it.status !== 'resolved').map((it) => it.scope || []);
    const files = [];
    for (const p of lockPointCandidatePaths(backlogScopes)) {
      const abs = join(ROOT, p.slice('we:'.length));
      if (!existsSync(abs)) continue;
      try { files.push({ path: p, text: readFileSync(abs, 'utf8') }); } catch { /* directory / unreadable */ }
    }
    return { files, lockPoints: findLockPointFiles({ files, backlogScopes }) };
  };

  it('the ratified thresholds still trip over the live backlog — the gate is not inert', () => {
    const { files, lockPoints } = liveLockPoints();
    expect(files.length).toBeGreaterThan(0); // the candidate scan itself must not come back empty
    expect(
      lockPoints.length > 0 ? [] : ['findLockPointFiles flagged NOTHING over the real backlog'],
    ).toEqual([]);
  });

  it("still flags at least one of #2678's named lock points", () => {
    const flagged = liveLockPoints().lockPoints.map((lp) => lp.path);
    expect(
      NAMED_TARGETS_2678.some((t) => flagged.includes(t))
        ? NAMED_TARGETS_2678
        : [`none of ${NAMED_TARGETS_2678.join(', ')} flagged; flagged instead: ${flagged.join(', ') || '(nothing)'}`],
    ).toEqual(NAMED_TARGETS_2678);
  });
});

// ── #2967a — test-only exports ("extracted, tested, never wired") ──────────────────────────────────────────
// Each fixture is named for the REAL shape it is built from, and each carve-out gets its own case so deleting
// that carve-out reddens exactly one test.
describe('findTestOnlyExports — the reduceLensJury class (#2967a)', () => {
  const mod = (file, content) => ({ file, content });
  const findings = (res) => [...res.errors, ...res.warnings];

  it('flags an export nothing imports and its own module never uses again (the reduceLensJury shape)', () => {
    const res = findTestOnlyExports([
      mod('scripts/lib/converge-core.mjs', 'export function reduceLensJury(a) { return a; }\n'),
      mod('scripts/lib/other.mjs', "import { somethingElse } from './converge-core.mjs';\n"),
    ], {});
    const all = findings(res);
    expect(all).toHaveLength(1);
    expect(all[0].descriptor).toEqual({ kind: 'test-only-export', file: 'scripts/lib/converge-core.mjs', export: 'reduceLensJury' });
    // Warn-first today (#2967 ships (a) on the COMPOSE_TRAITS_ENFORCED precedent) — pinned to the flag, so
    // flipping the flag moves the finding to `errors` without this test lying about where it lands.
    expect(TEST_ONLY_EXPORT_ENFORCED ? res.errors : res.warnings).toHaveLength(1);
  });

  it('does not flag an export another non-test module imports', () => {
    expect(findings(findTestOnlyExports([
      mod('scripts/lib/converge-core.mjs', 'export function reduceLensJury(a) { return a; }\n'),
      mod('scripts/lib/wired.mjs', "import { reduceLensJury } from './converge-core.mjs';\n"),
    ], {}))).toEqual([]);
  });

  it('does not flag an export the module itself still calls (a test seam over LIVE behaviour)', () => {
    expect(findings(findTestOnlyExports([
      mod('scripts/conveyor/tick-core.mjs', 'export function routeExit(c) { return c; }\nconst main = () => routeExit(0);\nmain();\n'),
    ], {}))).toEqual([]);
  });

  it('does not flag a STAR-IMPORTED module (the check-standards.conformance.test.mjs `import * as rules` shape)', () => {
    expect(findings(findTestOnlyExports(
      [mod('scripts/check-standards-rules.mjs', 'export const HTML_ELEMENTS = new Set();\n')],
      { starImportedSpecifiers: new Set(['check-standards-rules.mjs']) },
    ))).toEqual([]);
  });

  it('does not flag a CLI-SHELLED file (the review-core-cli.mjs / review-parked-prs.mjs harness-body shape)', () => {
    expect(findings(findTestOnlyExports(
      [mod('scripts/review-core-cli.mjs', 'export function parseFlags(a) { return a; }\n')],
      { subprocessReferencedFiles: new Set(['review-core-cli.mjs']) },
    ))).toEqual([]);
  });

  it('honours `@test-only-export-ok:` in the export\'s own leading comment', () => {
    expect(findings(findTestOnlyExports([
      mod('scripts/lib/review-policy.mjs', '// @test-only-export-ok: the conformance suite IS the intended consumer\nexport const REVIEW_POLICY = {};\n'),
    ], {}))).toEqual([]);
  });

  it('ignores a marker that is not the export\'s own leading comment (the hasCohesiveEscapeHatch r0/r1 regression)', () => {
    // r0's bug, transplanted: a file that merely DOCUMENTS the hatch (in a docstring example, in prose, or under
    // a blank line) must not exempt itself. Only the unbroken comment run directly above the export counts.
    const documented = [
      '/** Docs: put `@test-only-export-ok: <reason>` above an export to exempt it. */',
      'const HELP = `usage:',
      '// @test-only-export-ok: forged from inside a template literal',
      '`;',
      '',
      'export const REVIEW_POLICY = {};',
    ].join('\n');
    const all = findings(findTestOnlyExports([mod('scripts/lib/review-policy.mjs', documented)], {}));
    expect(all.map((f) => f.descriptor.export)).toEqual(['REVIEW_POLICY']);
  });

  it('a bare marker with no reason does not exempt', () => {
    expect(findings(findTestOnlyExports([
      mod('scripts/lib/x.mjs', '// @test-only-export-ok:\nexport const A = 1;\n'),
    ], {})).map((f) => f.descriptor.export)).toEqual(['A']);
  });

  it('extractExportedNames reads the declaration forms, not `export {}` lists', () => {
    const src = 'export const A = 1;\nexport function b() {}\nexport async function c() {}\nexport class D {}\nexport { A as E };\n';
    expect(extractExportedNames(src).map((e) => e.name)).toEqual(['A', 'b', 'c', 'D']);
  });

  it('hasTestOnlyExportOkMarker accepts a JSDoc block directly above the export', () => {
    const src = '/**\n * Why: sibling repo consumes this.\n * @test-only-export-ok: consumed by frontierui, not visible here\n */\nexport const A = 1;\n';
    expect(hasTestOnlyExportOkMarker(src, src.indexOf('export const A'))).toBe(true);
  });

  it('the real repo stays clean for the three known false-positive shapes (standing guard)', () => {
    // Mirrors the check-standards.mjs wiring: same walk, same structural sets.
    const SKIP_DIRS = new Set(['node_modules', 'dist', '.git', '__snapshots__']);
    const isTestPath = (p) => p.includes('/__tests__/') || p.includes('/__fixtures__/') || p.endsWith('.test.mjs');
    const everyModule = [];
    const walkMjs = (dir, rel) => {
      for (const ent of readdirSync(dir, { withFileTypes: true })) {
        if (SKIP_DIRS.has(ent.name)) continue;
        const abs = join(dir, ent.name);
        const relPath = rel ? `${rel}/${ent.name}` : ent.name;
        if (ent.isDirectory()) walkMjs(abs, relPath);
        else if (ent.name.endsWith('.mjs')) everyModule.push({ file: relPath, content: readFileSync(abs, 'utf8') });
      }
    };
    for (const top of ['scripts', 'skills-src']) if (existsSync(join(ROOT, top))) walkMjs(join(ROOT, top), top);
    const starImportedSpecifiers = new Set();
    const subprocessReferencedFiles = new Set();
    const shellSources = everyModule.filter((m) => !isTestPath(m.file));
    shellSources.push({ file: 'package.json', content: readFileSync(join(ROOT, 'package.json'), 'utf8') });
    for (const { content } of everyModule)
      for (const m of content.matchAll(/import\s+\*\s+as\s+[\w$]+\s+from\s*['"]([^'"]+)['"]/g))
        starImportedSpecifiers.add(m[1].split('/').pop());
    for (const { file, content } of shellSources)
      for (const m of content.matchAll(/node\s+(?:--[\w-]+(?:=\S+)?\s+)*(?:we:)?["']?((?:\.\/)?(?:scripts|skills-src)\/[\w./-]+\.mjs)/g)) {
        const base = m[1].split('/').pop();
        if (base !== file.split('/').pop()) subprocessReferencedFiles.add(base);
      }
    const res = findTestOnlyExports(everyModule.filter((m) => !isTestPath(m.file)), { starImportedSpecifiers, subprocessReferencedFiles });
    const all = [...res.errors, ...res.warnings];
    expect(everyModule.length).toBeGreaterThan(50);          // the walk itself must not come back empty
    // The three false-positive categories #2967 named, asserted on the LIVE tree — each PINNED TO AN EXPORT THAT
    // ITS OWN CARVE-OUT IS THE ONLY THING SUPPRESSING (PR #1235 review, finding 5). The r0 anchors were vacuous:
    // `scripts/review-core-cli.mjs` and `scripts/check-standards-rules.mjs` stayed green with their carve-outs
    // deleted (their exports are wired anyway), and `REVIEW_POLICY` is held up by the internal-use carve-out, not
    // by the marker it was written to demonstrate. Measured 2026-08-13 by re-running the rule with each carve-out
    // set emptied: 9 findings ride on the star-import set, 4 on the CLI-shell set, 8 on the marker.
    expect(all.filter((f) => f.descriptor.export === 'buildMergeArgs')).toEqual([]);        // CLI-shelled (scripts/pr-land.mjs)
    expect(all.filter((f) => f.descriptor.export === 'POLICY_TODO_OWED_TO')).toEqual([]);   // `@test-only-export-ok:` marker (review-policy.mjs)
    expect(all.filter((f) => f.descriptor.export === 'renderJuryCharter')).toEqual([]);     // star-imported (scripts/lib/review-core.mjs)
    // …and the scan is not inert: it still finds the class it exists for.
    expect(all.length).toBeGreaterThan(0);
  });
});

// ── #2967b — mandate params spliced into instruction text with no fence ────────────────────────────────────
describe('findUnfencedMandateParams — the #2438 fence, generalized (#2967b)', () => {
  const lib = (content, file = 'scripts/lib/review-core.mjs') => [{ file, content }];
  const findings = (res) => [...res.errors, ...res.warnings];

  it('flags an unfenced caller-supplied param (the review-pr.mjs `goal: read.title` shape)', () => {
    const src = [
      'export function buildSubjectMandate({ subjectNoun = "diff", goal = "" } = {}) {',
      '  return [`You are reviewing a ${subjectNoun}.`, `WHAT THIS IS TRYING TO DO: ${String(goal).trim()}`].join("\\n");',
      '}',
    ].join('\n');
    const all = findings(findUnfencedMandateParams(lib(src, 'scripts/lib/jury-core.mjs')));
    expect(all).toHaveLength(1);
    expect(all[0].descriptor).toEqual({ kind: 'unfenced-mandate-param', file: 'scripts/lib/jury-core.mjs', builder: 'buildSubjectMandate', param: 'goal' });
    expect(UNFENCED_MANDATE_ENFORCED ? all[0] : null).toBeTruthy(); // #2967 RULED: this one errors from day one
  });

  it('is an ERROR, not a warning, at the shipped default', () => {
    const src = 'export function buildXMandate({ goal = "" } = {}) {\n  return `goal: ${goal}`;\n}';
    const res = findUnfencedMandateParams(lib(src));
    expect(res.errors).toHaveLength(UNFENCED_MANDATE_ENFORCED ? 1 : 0);
    expect(res.warnings).toHaveLength(UNFENCED_MANDATE_ENFORCED ? 0 : 1);
  });

  it('accepts a param routed through fenceUntrusted alongside FENCED_DATA_RULE', () => {
    const src = [
      'export function buildPlanMandate({ task = "" } = {}) {',
      '  return [FENCED_DATA_RULE, fenceUntrusted("task", task)].join("\\n");',
      '}',
    ].join('\n');
    expect(findings(findUnfencedMandateParams(lib(src)))).toEqual([]);
  });

  it('accepts an OPT-IN fence (the buildEditorMandate `fenced` shape) — and says so: call sites are not checked', () => {
    const src = [
      'export function buildEditorMandate({ findings = [], fenced = false } = {}) {',
      '  const lines = findings.join("\\n");',
      '  return [fenced ? FENCED_DATA_RULE : "", `Findings: ${fenced ? fenceUntrusted("findings", lines) : lines}`].join(" ");',
      '}',
    ].join('\n');
    expect(findings(findUnfencedMandateParams(lib(src)))).toEqual([]);
  });

  it('flags a fenced builder whose returned text never states FENCED_DATA_RULE', () => {
    const src = 'export function buildPlanMandate({ task = "" } = {}) {\n  return `Judge: ${fenceUntrusted("task", task)}`;\n}';
    const all = findings(findUnfencedMandateParams(lib(src)));
    expect(all).toHaveLength(1);
    expect(all[0].descriptor.param).toBe(null);
    expect(all[0].message).toMatch(/never states `FENCED_DATA_RULE`/);
  });

  it('does not flag the closed vocabularies in MANDATE_FENCE_ALLOWED_PARAMS', () => {
    const src = [
      'export function buildPanelMandate({ lens, round = 1, roundCap = 3, contextIsolation = "diff-only", subjectNoun = "diff", findingAnchor = "file" } = {}) {',
      '  return `${lens} ${round}/${roundCap} ${contextIsolation} ${subjectNoun} ${findingAnchor}`;',
      '}',
    ].join('\n');
    expect(findings(findUnfencedMandateParams(lib(src)))).toEqual([]);
    expect([...MANDATE_FENCE_ALLOWED_PARAMS]).toContain('lens');
  });

  it('does not flag a param that never reaches the mandate text', () => {
    // `writeTarget` is pushed as a whole line — a caller-supplied CLAUSE, never a value spliced into one.
    const src = 'export function buildXMandate({ writeTarget = "" } = {}) {\n  return ["Revise the diff.", writeTarget].join(" ");\n}';
    expect(findings(findUnfencedMandateParams(lib(src)))).toEqual([]);
  });

  it('over-flags rather than under-flags: a param read only for its truthiness inside `${…}` still counts', () => {
    // Documented bluntness (limit 2 in the rule's block comment) — no expression parser, so a mention inside an
    // interpolated expression is treated as a splice. The cost of being wrong here is one allow-list line; the
    // cost of the opposite mistake is a missed finding, so the scan points that way on purpose.
    const src = 'export function buildXMandate({ goal = "" } = {}) {\n  return `${goal ? "has goal" : "no goal"}`;\n}';
    expect(findings(findUnfencedMandateParams(lib(src))).map((f) => f.descriptor.param)).toEqual(['goal']);
  });

  // ── PR #1235 review, blocker 1: a COMMENT must never switch the rule off ────────────────────────────────
  // r0 regex-scanned the raw body, so any text that merely SPELLED a fence exempted the param. Reproduced on
  // the real `buildSubjectMandate`: the goal fence removed + one deferral comment left in its place = 0 errors.
  it('a comment that merely MENTIONS the fence does not exempt a raw splice', () => {
    const src = [
      'export function buildSubjectMandate({ goal = "" } = {}) {',
      "  // TODO(#9999): fenceUntrusted('goal', String(goal).trim()) once the tag budget lands.",
      '  return `WHAT THIS IS TRYING TO DO: ${String(goal).trim()}`;',
      '}',
    ].join('\n');
    expect(findings(findUnfencedMandateParams(lib(src))).map((f) => f.descriptor.param)).toEqual(['goal']);
  });

  it('a string literal that mentions the fence does not exempt a raw splice', () => {
    const src = [
      'export function buildXMandate({ goal = "" } = {}) {',
      '  const hint = "use fenceUntrusted(goal) here";',
      '  return `${goal} — ${hint}`;',
      '}',
    ].join('\n');
    expect(findings(findUnfencedMandateParams(lib(src))).map((f) => f.descriptor.param)).toEqual(['goal']);
  });

  it('a fence whose TAG happens to spell the param name does not exempt it — only the DATA argument counts', () => {
    const src = [
      'export function buildXMandate({ goal = "" } = {}) {',
      '  return [FENCED_DATA_RULE, fenceUntrusted("goal", somethingElse), `${goal}`].join(" ");',
      '}',
    ].join('\n');
    expect(findings(findUnfencedMandateParams(lib(src))).map((f) => f.descriptor.param)).toEqual(['goal']);
  });

  // ── PR #1235 review, blocker-adjacent 2: the same masking must not invent findings either ───────────────
  it('a comment or docblock containing `${param}` is NOT a splice (this repo writes those constantly)', () => {
    const src = [
      '/** Historically this spliced ${goal} straight into instruction position. */',
      'export function buildXMandate({ goal = "" } = {}) {',
      '  // The caller supplies ${goal}; we only hand it on.',
      '  return buildSubjectMandate({ goal, fenced: true });',
      '}',
    ].join('\n');
    expect(findings(findUnfencedMandateParams(lib(src)))).toEqual([]);
  });

  it('a DELEGATE that forwards `fenced` supplies the data rule (the buildMandate/buildPanelMandate shape)', () => {
    // `buildMandate` and `buildPanelMandate` never state FENCED_DATA_RULE themselves — they pass `fenced`
    // through to `buildSubjectMandate`, which owns the wording. Adding their own second fence must not redden.
    const src = [
      'export function buildXMandate({ goal = "", extra = "", fenced = false } = {}) {',
      '  return buildSubjectMandate({ goal, fenced, bodyLines: [fenceUntrusted("extra", extra)] });',
      '}',
    ].join('\n');
    expect(findings(findUnfencedMandateParams(lib(src)))).toEqual([]);
  });

  it('a commented-out builder is not scanned as a live one', () => {
    const src = ['// export function buildOldMandate({ goal = "" } = {}) {', '//   return `${goal}`;', '// }'].join('\n');
    expect(findings(findUnfencedMandateParams(lib(src)))).toEqual([]);
  });

  it('a regex literal containing quotes does not derail the scan', () => {
    const src = [
      'export function buildXMandate({ goal = "" } = {}) {',
      "  const clean = String(goal).replace(/['\"]/g, '');",
      '  return `${goal} ${clean}`;',
      '}',
    ].join('\n');
    expect(findings(findUnfencedMandateParams(lib(src))).map((f) => f.descriptor.param)).toEqual(['goal']);
  });

  it('ignores a non-mandate export (only `build…Mandate` is in scope)', () => {
    const src = 'export function renderComment({ body = "" } = {}) {\n  return `body: ${body}`;\n}';
    expect(findings(findUnfencedMandateParams(lib(src)))).toEqual([]);
  });

  it('rule 19 is WIRED: the gate imports the real walk, and the real walk still reaches the rule', () => {
    // Finding 4 of the PR #1235 review: mutating the call to `findUnfencedMandateParams([])` left all 314 tests
    // green, because both standing guards RE-IMPLEMENT the walk in this file — they pin the rule and never the
    // registration. So this test never re-implements anything. It (a) runs the SHIPPED walk
    // (`scanUnfencedMandateParams`, the exact function check-standards.mjs calls) over a throwaway root whose
    // one mandate builder is genuinely unfenced, which reddens the moment the walk stops reaching the rule or
    // stops reading scripts/lib; and (b) pins that check-standards.mjs still calls it, outside any try/catch —
    // a rule that ERRORS may not be demoted to a warning by a catch-all.
    const root = mkdtempSync(join(tmpdir(), 'rule19-wiring-'));
    try {
      mkdirSync(join(root, 'scripts', 'lib'), { recursive: true });
      writeFileSync(
        join(root, 'scripts', 'lib', 'fixture-core.mjs'),
        'export function buildFixtureMandate({ goal = "" } = {}) {\n  return `Goal: ${String(goal).trim()}`;\n}\n',
      );
      const res = scanUnfencedMandateParams(root);
      expect([...res.errors, ...res.warnings].map((f) => f.descriptor)).toEqual([
        { kind: 'unfenced-mandate-param', file: 'scripts/lib/fixture-core.mjs', builder: 'buildFixtureMandate', param: 'goal' },
      ]);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
    const gate = readFileSync(join(ROOT, 'scripts/check-standards.mjs'), 'utf8');
    expect(gate).toMatch(/import \{ scanUnfencedMandateParams \} from '\.\/lib\/mandate-fence-scan\.mjs';/);
    expect(gate).toMatch(/const unfenced = scanUnfencedMandateParams\(ROOT\);/);
    const from = gate.indexOf('// ── 19. Unfenced mandate params');
    const nextSection = gate.indexOf('\n// ── ', from + 1);
    expect(gate.slice(from, nextSection < 0 ? undefined : nextSection)).not.toMatch(/^\s*try\s*\{/m);
  });

  it('the real scripts/lib mandate builders stay clean (standing guard, through the check-standards.mjs wiring)', () => {
    // Reads through the SHIPPED walk rather than a copy of it, so "clean" means clean over the module set the
    // gate actually judges (PR #1235 review, finding 4).
    const mods = readMandateBuilderModules(ROOT);
    expect(findings(scanUnfencedMandateParams(ROOT))).toEqual([]);
    // Not inert: the scan really did find the builders it is meant to be judging.
    const builders = mods.filter((m) => /export function build[A-Za-z0-9_$]*Mandate/.test(m.content));
    expect(builders.length).toBeGreaterThan(2);
  });
});

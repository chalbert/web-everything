/**
 * @file gate-entrypoint-integration.test.mjs — hermetic INTEGRATION test of the REAL drain entrypoint.
 *
 * WHY THIS EXISTS ALONGSIDE THE PURE SUITES. The pure tests prove `decideReviewGate`/`scoreEscalation`/
 * `classifyPr`/`hasUnclearedReviewLabel` return the right verdict for a given input. They CANNOT prove the
 * thing that actually protects `main`: that `runCli` — the real `node scripts/merge-ai-prs.mjs` entrypoint —
 * actually CONSULTS the gate before it merges. A refactor could leave every pure function perfect yet stop
 * calling one of them (or call it with the wrong signals), and no pure test would notice. This test closes
 * that gap by driving the actual CLI end-to-end.
 *
 * HOW IT STAYS HERMETIC (and CI-safe). It puts fake `gh` and `git` executables on `PATH` (a shim dir this
 * test writes), so the real `runCli` runs unmodified but every network/repo call is answered from a canned
 * PR fixture — no GitHub, no real repo, no auth. `--dry-run` means it decides but never merges; we read the
 * decision off its `--json` output (`toMerge` / `parked` / `skipped`). The fake `git diff` fails on purpose
 * so the escalation pass falls back to the (also-faked) `gh pr view --json files`, i.e. ALL escalation input
 * is controlled through the fixture. Everything lives in an OS temp dir; nothing touches the real tree.
 *
 * Under #2162/#2171/#2285/#2366 (the auto-review gate) — the entrypoint half of the gate-invariants tripwires.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, writeFileSync, chmodSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SCRIPT = resolve(HERE, '..', 'merge-ai-prs.mjs'); // the REAL entrypoint under test

// ── fake gh: answers pr list / pr view from the fixture pointed to by $GATE_FIXTURE; succeeds quietly else ──
const FAKE_GH = `#!/usr/bin/env node
const fs = require('fs');
const fx = JSON.parse(fs.readFileSync(process.env.GATE_FIXTURE, 'utf8'));
const a = process.argv.slice(2);
const ji = a.indexOf('--json');
const fields = ji >= 0 ? String(a[ji + 1] || '') : '';
function out(o) { process.stdout.write(JSON.stringify(o)); process.exit(0); }
if (a[0] === 'pr' && a[1] === 'list') out(fx.prs);
if (a[0] === 'pr' && a[1] === 'view') {
  const pr = fx.prs.find((p) => String(p.number) === String(a[2])) || {};
  if (fields.includes('commits')) out({ commits: pr._commits || [] });
  if (fields.includes('files')) out({ files: pr._files || [] });
  if (fields.includes('body')) out({ body: pr.body || '' });
  if (fields.includes('comments')) out({ comments: [] });
  out({});
}
// pr edit / pr comment / label create / api … — succeed silently (dry-run shouldn't reach the mutating ones)
process.stdout.write(''); process.exit(0);
`;

// ── fake git: canned origin slug; `diff` FAILS (forces the gh-files escalation fallback); else no-op ──
const FAKE_GIT = `#!/usr/bin/env node
const a = process.argv.slice(2);
if (a[0] === 'remote' && a[1] === 'get-url') { process.stdout.write('git@github.com:chalbert/web-everything.git\\n'); process.exit(0); }
if (a[0] === 'diff') { process.exit(1); } // force computeNetDiffChangedFiles → gh 'pr view --json files' fallback
process.exit(0);
`;

let shimDir;
let workDir;

beforeAll(() => {
  shimDir = mkdtempSync(join(tmpdir(), 'gate-shim-'));
  workDir = mkdtempSync(join(tmpdir(), 'gate-work-'));
  writeFileSync(join(shimDir, 'gh'), FAKE_GH);
  writeFileSync(join(shimDir, 'git'), FAKE_GIT);
  chmodSync(join(shimDir, 'gh'), 0o755);
  chmodSync(join(shimDir, 'git'), 0o755);
});
afterAll(() => {
  for (const d of [shimDir, workDir]) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best-effort */ } }
});

/** Run the REAL entrypoint against a canned fixture, return its parsed --json result. */
function runDrain(fixture, args) {
  const fxPath = join(workDir, `fixture-${fixture._id}.json`);
  writeFileSync(fxPath, JSON.stringify(fixture));
  const stdout = execFileSync('node', [SCRIPT, ...args, '--dry-run', '--this-repo', '--json'], {
    cwd: workDir,                                   // a clean dir — no park-state, no real repo
    env: { ...process.env, PATH: `${shimDir}:${process.env.PATH}`, GATE_FIXTURE: fxPath },
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const line = stdout.trim().split('\n').filter(Boolean).pop(); // the last line is the JSON result
  return JSON.parse(line);
}

const nums = (arr) => (arr || []).map((x) => Number(x.num));
const GREEN = [{ name: 'test', conclusion: 'SUCCESS', status: 'COMPLETED' }];
const AI_COMMIT = [{ authors: [{ name: 'Claude', email: 'noreply@anthropic.com' }] }];

describe('the real drain entrypoint consults the gate before merging', () => {
  it('label-scoped drain: a gate-self PR PARKS as review:human and never lands, while a clean leaf PR would merge', () => {
    const fixture = {
      _id: 'label',
      prs: [
        { number: 101, title: 'clean leaf', body: 'a real summary', headRefName: 'lane/a', baseRefName: 'main',
          mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: GREEN,
          labels: [{ name: 'ready-to-merge' }], _commits: AI_COMMIT, _files: [{ path: 'backlog/x.md', additions: 5, deletions: 1 }] },
        { number: 102, title: 'edits the gate itself', body: 'a real summary', headRefName: 'lane/b', baseRefName: 'main',
          mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: GREEN,
          labels: [{ name: 'ready-to-merge' }], _commits: AI_COMMIT, _files: [{ path: 'scripts/merge-ai-prs.mjs', additions: 3, deletions: 1 }] },
        { number: 103, title: 'leaf but already human-gated', body: 'a real summary', headRefName: 'lane/c', baseRefName: 'main',
          mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: GREEN,
          labels: [{ name: 'ready-to-merge' }, { name: 'review:human' }], _commits: AI_COMMIT, _files: [{ path: 'backlog/y.md', additions: 2, deletions: 0 }] },
      ],
    };
    const r = runDrain(fixture, ['--label=ready-to-merge', '--no-reconcile-labels']);

    // the clean leaf PR is landable — the entrypoint would merge it
    expect(nums(r.toMerge)).toContain(101);

    // the gate-self PR must be PARKED as human-required, and must NOT be in the merge set — the core proof
    // that the REAL entrypoint refuses to auto-merge an edit to its own gate
    expect(nums(r.toMerge)).not.toContain(102);
    expect(nums(r.merged)).not.toContain(102);
    const p102 = r.parked.find((p) => Number(p.num) === 102);
    expect(p102).toBeTruthy();
    expect(p102.humanRequired).toBe(true);

    // the already-human-labelled PR is held by the sticky veto too, even though its own diff is a leaf
    expect(nums(r.toMerge)).not.toContain(103);
    const p103 = r.parked.find((p) => Number(p.num) === 103);
    expect(p103).toBeTruthy();
    expect(p103.humanRequired).toBe(true);
  });

  it('bare /merge sweep: the #2366 backstop refuses a PR already carrying review:pending, but lands a clean one', () => {
    const fixture = {
      _id: 'bare',
      prs: [
        { number: 201, title: 'parked by a prior drain', body: 'a real summary', headRefName: 'lane/d', baseRefName: 'main',
          mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: GREEN,
          labels: [{ name: 'review:pending' }], _commits: AI_COMMIT, _files: [{ path: 'backlog/z.md', additions: 1, deletions: 0 }] },
        { number: 202, title: 'clean orphan', body: 'a real summary', headRefName: 'lane/e', baseRefName: 'main',
          mergeable: 'MERGEABLE', mergeStateStatus: 'CLEAN', statusCheckRollup: GREEN,
          labels: [], _commits: AI_COMMIT, _files: [{ path: 'backlog/w.md', additions: 1, deletions: 0 }] },
      ],
    };
    const r = runDrain(fixture, []); // no --label ⇒ bare sweep ⇒ REVIEW_ESCALATION off ⇒ the #2366 backstop guards it

    // the review:pending PR must be refused (never re-shipped by a concurrent bare sweep) — plateau#11 / #290
    expect(nums(r.toMerge)).not.toContain(201);
    expect(nums(r.merged)).not.toContain(201);
    expect(nums(r.skipped)).toContain(201);

    // the clean orphan with no review label still lands — the backstop only refuses un-cleared labels
    expect(nums(r.toMerge)).toContain(202);
  });
});

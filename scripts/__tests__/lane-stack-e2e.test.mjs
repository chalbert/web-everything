/**
 * @file scripts/__tests__/lane-stack-e2e.test.mjs
 * @description End-to-end proof of #2394 (producer overlap-stacking, under epic #2387) driving the REAL
 *   `we:scripts/lane-stack.mjs` CLI — the fs + git boundary around the pure planner
 *   `we:scripts/readiness/overlap-chain.mjs` (union-find overlap chains, push-time `actual ⊆ declared`
 *   re-check; unit-proven in `we:scripts/readiness/__tests__/overlap-chain.test.mjs`). Here we exercise the
 *   boundary against a throwaway LOCAL bare origin (no network, no lane-pool — a "lane" is just a plain clone
 *   of that origin; `lane-pool acquire --base` is proven separately in `lane-pool-acquire-base.test.mjs`).
 *   One shared `--plan` scratch file threads every seam, exactly as a serial batch would.
 *
 *   The three #2394 acceptance scenarios, each with real git:
 *     1. A 3-item chain sharing one file lands with ZERO conflict-rebases — every parent is an ancestor, so
 *        each `merge --no-ff` is three-way clean; the sibling counterfactual (same file, off pre-chain main)
 *        would conflict.
 *     2. A provably-disjoint item lands independently while the chain is open.
 *     3. An UNDER-DECLARED sibling is caught at push (`recheck` exit 4 = rebase-required), rebased onto the
 *        chain frontier IN-SESSION, and only then shipped — never reaching the drain as a mislabelled sibling.
 *   Plus (review round 2): the BRIDGE path through the CLI (pinned `mergeTips`, clean recheck + land), the
 *   `init` re-init guard (a mid-batch re-init must never erase the chain state), the --base trust boundary
 *   (bound to the recorded acquire point; option-shaped values rejected before git), the fail-loud sha pins,
 *   and negatives: `init` against an origin lacking the capability marker reports `supported:false`.
 */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { spawnSync, execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, mkdtempSync, rmSync, existsSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { tmpdir } from 'node:os';

const SCRIPT = resolve(process.cwd(), 'scripts/lane-stack.mjs');
const MARKER_PATH = 'scripts/readiness/drain-capability.json';

function git(args, cwd) {
  return execFileSync('git', args, { cwd, encoding: 'utf8' }).trim();
}

/** Run the lane-stack CLI with --json; returns { code, json, out, err }. json is null if stdout isn't JSON. */
function runStack(args, cwd) {
  const r = spawnSync('node', [SCRIPT, ...args, '--json'], { cwd, encoding: 'utf8' });
  const out = String(r.stdout || '');
  let json = null;
  try { json = JSON.parse(out); } catch { /* human-mode or crash — leave null, assert on code/err */ }
  return { code: r.status ?? 1, json, out, err: String(r.stderr || '') };
}

function writeFile(cwd, rel, content) {
  const abs = join(cwd, rel);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, content);
}

function commitAll(cwd, msg) {
  git(['add', '-A'], cwd);
  git(['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'commit', '--quiet', '-m', msg], cwd);
}

let base, originDir, primaryDir, planPath, mainSha0;

/** Build a bare origin whose `main` carries a few files INCLUDING the capability marker {"gateVersion":1}. */
function buildOrigin(dir, withMarker) {
  git(['init', '--quiet', '--bare', '--initial-branch=main', dir]);
  const seed = join(base, `seed-${Math.abs(hashName(dir))}`);
  git(['clone', '--quiet', dir, seed]);
  writeFile(seed, 'README.md', 'web-everything fixture\n');
  writeFile(seed, 'shared.txt', 'base\n');
  if (withMarker) writeFile(seed, MARKER_PATH, JSON.stringify({ gateVersion: 1 }, null, 2) + '\n');
  commitAll(seed, 'main v1');
  const sha = git(['rev-parse', 'HEAD'], seed);
  git(['push', '--quiet', 'origin', 'main'], seed);
  return sha;
}
function hashName(s) { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return h; }

/** A "lane" = a fresh clone of origin, optionally reset HARD onto a predecessor's pushed tip sha. */
function makeLane(name, fromSha) {
  const dir = join(base, 'lanes', name);
  git(['clone', '--quiet', originDir, dir]);
  if (fromSha) git(['reset', '--hard', fromSha], dir);
  return dir;
}

/** Push this lane's HEAD to `lane/<id>` on origin; return the pushed tip sha. */
function pushLane(cwd, id) {
  git(['push', '--quiet', 'origin', `HEAD:refs/heads/lane/${id}`], cwd);
  return git(['rev-parse', 'HEAD'], cwd);
}

/** Attempt a merge; return the exit code (0 = clean, non-zero = conflict). Never throws. The inline
 *  identity matters: a `--no-ff` merge CREATES a commit, and a CI runner has no global user.name/email —
 *  without it git exits 128 ("committer identity unknown") and every merge reads as a spurious conflict. */
function tryMerge(cwd, ref) {
  const r = spawnSync('git', ['-c', 'user.email=t@t.com', '-c', 'user.name=t', 'merge', '--no-ff', '--no-edit', ref], { cwd, encoding: 'utf8' });
  return r.status ?? 1;
}

/**
 * Build the shared 3-item chain end-to-end via the real CLI: init the plan, then for each of A/B/C run
 * plan-item (cwd = primary clone of origin), work + push its lane clone, recheck (stacked items), and record.
 * Returns the per-item tip shas and lane dirs, and asserts the stacking decisions along the way.
 */
function buildChain() {
  const init = runStack(['init', `--plan=${planPath}`], primaryDir);
  expect(init.code, init.err).toBe(0);
  expect(init.json.supported, 'marker present on origin/main ⇒ stacking enabled').toBe(true);

  // --- Item A: first touch of shared.txt → SIBLING off origin/main, opens the chain.
  const planA = runStack(['plan-item', `--plan=${planPath}`, '--id=A', '--files=we:shared.txt,we:a.txt'], primaryDir);
  expect(planA.code, planA.err).toBe(0);
  expect(planA.json.stacked).toBe(false);

  const laneA = makeLane('A', null);
  writeFile(laneA, 'shared.txt', 'base\nA\n');
  writeFile(laneA, 'a.txt', 'a\n');
  commitAll(laneA, 'A: shared + a');
  const aSha = pushLane(laneA, 'A');
  const recA = runStack(['record', `--plan=${planPath}`, '--id=A', '--base=origin/main', '--tip-ref=lane/A'], laneA);
  expect(recA.code, recA.err).toBe(0);

  // --- Item B: overlaps shared.txt → STACKS on A; acquire ref is A's recorded lane tip.
  const planB = runStack(['plan-item', `--plan=${planPath}`, '--id=B', '--files=we:shared.txt,we:b.txt'], primaryDir);
  expect(planB.code, planB.err).toBe(0);
  expect(planB.json.stacked).toBe(true);
  expect(planB.json.base).toBe('A');
  expect(planB.json.acquireBase, 'stacked item acquires on the parent\'s RECORDED tip sha — pinned to the audited state, not the movable lane ref').toBe(aSha);

  const laneB = makeLane('B', aSha); // starts AT A's tip
  expect(readFileSync(join(laneB, 'shared.txt'), 'utf8'), 'lane B sees A\'s not-yet-merged content').toBe('base\nA\n');
  writeFile(laneB, 'shared.txt', 'base\nA\nB\n'); // builds on A's content
  writeFile(laneB, 'b.txt', 'b\n');
  commitAll(laneB, 'B: shared + b');
  const recheckB = runStack(['recheck', `--plan=${planPath}`, '--id=B', `--base=${aSha}`], laneB);
  expect(recheckB.code, `B recheck should be clean: ${recheckB.err}`).toBe(0);
  expect(recheckB.json.verdict).toBe('clean');
  const bSha = pushLane(laneB, 'B');
  expect(runStack(['record', `--plan=${planPath}`, '--id=B', `--base=${aSha}`, '--tip-ref=lane/B'], laneB).code).toBe(0);

  // --- Item C: still overlaps shared.txt → STACKS on the NEW frontier B.
  const planC = runStack(['plan-item', `--plan=${planPath}`, '--id=C', '--files=we:shared.txt,we:c.txt'], primaryDir);
  expect(planC.code, planC.err).toBe(0);
  expect(planC.json.stacked).toBe(true);
  expect(planC.json.base, 'frontier moved past A to B').toBe('B');
  expect(planC.json.acquireBase).toBe(bSha);

  const laneC = makeLane('C', bSha);
  writeFile(laneC, 'shared.txt', 'base\nA\nB\nC\n');
  writeFile(laneC, 'c.txt', 'c\n');
  commitAll(laneC, 'C: shared + c');
  const recheckC = runStack(['recheck', `--plan=${planPath}`, '--id=C', `--base=${bSha}`], laneC);
  expect(recheckC.code, `C recheck should be clean: ${recheckC.err}`).toBe(0);
  const cSha = pushLane(laneC, 'C');
  expect(runStack(['record', `--plan=${planPath}`, '--id=C', `--base=${bSha}`, '--tip-ref=lane/C'], laneC).code).toBe(0);

  return { aSha, bSha, cSha };
}

beforeEach(() => {
  base = mkdtempSync(join(tmpdir(), 'lane-stack-e2e-'));
  originDir = join(base, 'origin.git');
  primaryDir = join(base, 'primary');
  planPath = join(base, 'stack-plan.json');
  mainSha0 = buildOrigin(originDir, true);
  git(['clone', '--quiet', originDir, primaryDir]); // the "primary checkout" init/plan-item run in
});

afterEach(() => {
  rmSync(base, { recursive: true, force: true });
});

describe('lane-stack e2e (#2394) — real git overlap-stacking', () => {
  it('Scenario 1: a 3-item chain sharing one file lands with ZERO conflict-rebases', () => {
    buildChain();

    // Land: merge A → B → C into a fresh clone of origin's main. Each parent is an ancestor of the next, so
    // every three-way merge is CLEAN (this is the "zero conflict-rebases" proof — the drain re-discovers no
    // conflict the authoring session already resolved).
    const land = join(base, 'land');
    git(['clone', '--quiet', originDir, land]);
    for (const id of ['A', 'B', 'C']) {
      expect(tryMerge(land, `origin/lane/${id}`), `merging lane/${id} must be conflict-free`).toBe(0);
    }
    expect(readFileSync(join(land, 'shared.txt'), 'utf8'), 'final shared.txt is C\'s version').toBe('base\nA\nB\nC\n');

    // Counterfactual guard: a SIBLING off pre-chain main editing the same file differently would NOT merge
    // clean once the chain landed — exactly the blind conflict stacking avoids.
    const sib = makeLane('sib', null); // off origin/main (pre-A)
    expect(readFileSync(join(sib, 'shared.txt'), 'utf8')).toBe('base\n');
    writeFile(sib, 'shared.txt', 'base\nSIBLING\n');
    commitAll(sib, 'sib: shared differently');
    pushLane(sib, 'sib');
    git(['fetch', '--quiet', 'origin'], land);
    expect(tryMerge(land, 'origin/lane/sib'), 'a same-file sibling off pre-chain main WOULD conflict').not.toBe(0);
    spawnSync('git', ['merge', '--abort'], { cwd: land });
  });

  it('Scenario 2: a provably-disjoint item lands independently while the chain is open', () => {
    buildChain();

    // D declares only its own file → SIBLING even mid-chain (disjoint from shared.txt).
    const planD = runStack(['plan-item', `--plan=${planPath}`, '--id=D', '--files=we:d.txt'], primaryDir);
    expect(planD.code, planD.err).toBe(0);
    expect(planD.json.stacked, 'disjoint item stays a plain sibling').toBe(false);

    const laneD = makeLane('D', null);
    writeFile(laneD, 'd.txt', 'd\n');
    commitAll(laneD, 'D: d');
    pushLane(laneD, 'D');
    expect(runStack(['record', `--plan=${planPath}`, '--id=D', '--base=origin/main', '--tip-ref=lane/D'], laneD).code).toBe(0);

    // Lands clean regardless of chain order: merge D first, then the whole chain, all conflict-free.
    const land = join(base, 'land');
    git(['clone', '--quiet', originDir, land]);
    for (const id of ['D', 'A', 'B', 'C']) {
      expect(tryMerge(land, `origin/lane/${id}`), `lane/${id} must merge clean`).toBe(0);
    }
    expect(readFileSync(join(land, 'd.txt'), 'utf8')).toBe('d\n');
  });

  it('Scenario 3: an under-declared item is caught at push and rebased IN-SESSION, never shipped as a sibling', () => {
    const { cSha } = buildChain();

    // E declares only e.txt → planned a SIBLING (disjoint from the chain by declaration).
    const planE = runStack(['plan-item', `--plan=${planPath}`, '--id=E', '--files=we:e.txt'], primaryDir);
    expect(planE.code, planE.err).toBe(0);
    expect(planE.json.stacked).toBe(false);

    // But the lane ACTUALLY touches shared.txt too (undeclared) — the overlap the plan didn't predict.
    const laneE = makeLane('E', null); // off origin/main
    writeFile(laneE, 'e.txt', 'e\n');
    writeFile(laneE, 'shared.txt', 'base\nE\n');
    commitAll(laneE, 'E: e + undeclared shared');

    // Push-time recheck catches it: exit 4, verdict rebase-required, onto = the chain frontier (#C) + its tip.
    const bad = runStack(['recheck', `--plan=${planPath}`, '--id=E', '--base=origin/main'], laneE);
    expect(bad.code, 'the never-push gate: exit 4 on rebase-required').toBe(4);
    expect(bad.json.verdict).toBe('rebase-required');
    expect(bad.json.undeclared).toEqual(['we:shared.txt']);
    expect(bad.json.onto, 'names the chain frontier item to rebase onto').toContain('C');
    expect(bad.json.ontoTips.C, 'carries the frontier tip sha/ref for the acquire').toBeTruthy();
    expect(bad.json.ontoTips.C.we.sha).toBe(cSha);
    expect(bad.json.ontoTips.C.we.ref).toBe('lane/C');

    // In-session repair: reset the lane onto the frontier tip and RE-APPLY its edits on top (deterministic
    // content so it applies clean) — the real rebase a producer performs with the context still hot.
    git(['reset', '--hard', cSha], laneE);
    writeFile(laneE, 'e.txt', 'e\n');
    writeFile(laneE, 'shared.txt', 'base\nA\nB\nC\nE\n'); // builds on C's content
    commitAll(laneE, 'E: rebased onto C');

    // Record the rebase in the plan (--base recomputes actuals), then re-gate: now clean.
    const ar = runStack(['apply-rebase', `--plan=${planPath}`, '--id=E', '--onto=C', `--base=${cSha}`], laneE);
    expect(ar.code, ar.err).toBe(0);
    const good = runStack(['recheck', `--plan=${planPath}`, '--id=E', `--base=${cSha}`], laneE);
    expect(good.code, `re-gate after rebase must pass: ${good.err}`).toBe(0);
    expect(good.json.verdict).toBe('clean');

    pushLane(laneE, 'E');
    expect(runStack(['record', `--plan=${planPath}`, '--id=E', `--base=${cSha}`, '--tip-ref=lane/E'], laneE).code).toBe(0);

    // The plan now records E stacked on the frontier — this is what feeds the manifest's --stack-parent flags.
    const plan = JSON.parse(readFileSync(planPath, 'utf8'));
    expect(plan.items.E.stackParents, 'E is now a stacked child of #C, not a sibling').toEqual(['C']);
    expect(plan.items.E.sibling).toBe(false);

    // And E merges clean after the chain (it descends from C, which lands first).
    const land = join(base, 'land');
    git(['clone', '--quiet', originDir, land]);
    for (const id of ['A', 'B', 'C', 'E']) {
      expect(tryMerge(land, `origin/lane/${id}`), `lane/${id} must merge clean`).toBe(0);
    }
    expect(readFileSync(join(land, 'shared.txt'), 'utf8')).toBe('base\nA\nB\nC\nE\n');
  });
});

describe('lane-stack e2e (#2394) — bridge through the CLI', () => {
  it('Scenario 4: an item bridging two chains gets PINNED merge tips, rechecks clean, and lands conflict-free', () => {
    expect(runStack(['init', `--plan=${planPath}`], primaryDir).code).toBe(0);

    // Two disjoint single-item chains A (a.txt) and B (b.txt).
    expect(runStack(['plan-item', `--plan=${planPath}`, '--id=A', '--files=we:a.txt'], primaryDir).json.stacked).toBe(false);
    const laneA = makeLane('A', null);
    writeFile(laneA, 'a.txt', 'a\n');
    commitAll(laneA, 'A: a');
    const aSha = pushLane(laneA, 'A');
    expect(runStack(['record', `--plan=${planPath}`, '--id=A', '--base=origin/main', '--tip-ref=lane/A'], laneA).code).toBe(0);

    expect(runStack(['plan-item', `--plan=${planPath}`, '--id=B', '--files=we:b.txt'], primaryDir).json.stacked).toBe(false);
    const laneB = makeLane('B', null);
    writeFile(laneB, 'b.txt', 'b\n');
    commitAll(laneB, 'B: b');
    const bSha = pushLane(laneB, 'B');
    expect(runStack(['record', `--plan=${planPath}`, '--id=B', '--base=origin/main', '--tip-ref=lane/B'], laneB).code).toBe(0);

    // E touches both → BRIDGE: acquire at the base parent's PINNED sha, merge the other parent's PINNED
    // sha (`mergeTips`) in-session — never the mutable lane refs, which a takeover/force-push could move.
    const planE = runStack(['plan-item', `--plan=${planPath}`, '--id=E', '--files=we:a.txt,we:b.txt'], primaryDir);
    expect(planE.code, planE.err).toBe(0);
    expect(planE.json.stacked).toBe(true);
    expect(new Set(planE.json.stackParents)).toEqual(new Set(['A', 'B']));
    expect(planE.json.mergeParents.length).toBe(1);
    const shaOf = { A: aSha, B: bSha };
    const mergeId = planE.json.mergeParents[0];
    expect(planE.json.acquireBase, 'acquire pinned to the base parent\'s recorded sha').toBe(shaOf[planE.json.base]);
    expect(planE.json.mergeTips[mergeId].we.sha, 'merge parent surfaced as a PINNED sha, not a bare item id').toBe(shaOf[mergeId]);
    expect(planE.json.detail).toMatch(/PINNED tip/);

    const laneE = makeLane('E', planE.json.acquireBase);
    expect(tryMerge(laneE, planE.json.mergeTips[mergeId].we.sha), 'in-session merge of the pinned tip is clean').toBe(0);
    writeFile(laneE, 'a.txt', 'a\nE\n');
    writeFile(laneE, 'b.txt', 'b\nE\n');
    commitAll(laneE, 'E: bridges a+b');

    const recheckE = runStack(['recheck', `--plan=${planPath}`, '--id=E', `--base=${planE.json.acquireBase}`], laneE);
    expect(recheckE.code, `bridge recheck must be clean: ${recheckE.err}`).toBe(0);
    expect(recheckE.json.verdict).toBe('clean');
    pushLane(laneE, 'E');
    expect(runStack(['record', `--plan=${planPath}`, '--id=E', `--base=${planE.json.acquireBase}`, '--tip-ref=lane/E'], laneE).code).toBe(0);

    // Both parents are ancestors of the bridge, so A → B → E all land three-way clean.
    const land = join(base, 'land');
    git(['clone', '--quiet', originDir, land]);
    for (const id of ['A', 'B', 'E']) {
      expect(tryMerge(land, `origin/lane/${id}`), `lane/${id} must merge clean`).toBe(0);
    }
    expect(readFileSync(join(land, 'a.txt'), 'utf8')).toBe('a\nE\n');
    expect(readFileSync(join(land, 'b.txt'), 'utf8')).toBe('b\nE\n');
  });

  it('plan-item hard-fails when a parent tip sha is missing — never falls back to the mutable ref', () => {
    expect(runStack(['init', `--plan=${planPath}`], primaryDir).code).toBe(0);
    expect(runStack(['plan-item', `--plan=${planPath}`, '--id=A', '--files=we:shared.txt'], primaryDir).code).toBe(0);
    const laneA = makeLane('A', null);
    writeFile(laneA, 'shared.txt', 'base\nA\n');
    commitAll(laneA, 'A: shared');
    pushLane(laneA, 'A');
    expect(runStack(['record', `--plan=${planPath}`, '--id=A', '--base=origin/main', '--tip-ref=lane/A'], laneA).code).toBe(0);

    // Corrupt the plan the way a sha-less record once could: the tip carries only the mutable ref.
    const plan = JSON.parse(readFileSync(planPath, 'utf8'));
    plan.items.A.tips.we = { ref: 'lane/A' };
    writeFileSync(planPath, JSON.stringify(plan));

    const b = runStack(['plan-item', `--plan=${planPath}`, '--id=B', '--files=we:shared.txt'], primaryDir);
    expect(b.code, 'an un-pinned acquire must be refused, not emitted as the movable ref').toBe(3);
    expect(b.json.detail).toMatch(/no recorded tip sha/);
  });
});

describe('lane-stack e2e (#2394) — init re-init guard', () => {
  it('a second init refuses (exit 3) and leaves the plan intact; --force starts a fresh plan', () => {
    expect(runStack(['init', `--plan=${planPath}`], primaryDir).code).toBe(0);
    expect(runStack(['plan-item', `--plan=${planPath}`, '--id=A', '--files=we:a.txt'], primaryDir).code).toBe(0);
    const before = readFileSync(planPath, 'utf8');

    const again = runStack(['init', `--plan=${planPath}`], primaryDir);
    expect(again.code, 'a mid-batch re-init must hard-fail, never silently erase the chain state').toBe(3);
    expect(again.json.detail).toMatch(/already exists/);
    expect(readFileSync(planPath, 'utf8'), 'the plan file is untouched').toBe(before);

    const forced = runStack(['init', `--plan=${planPath}`, '--force'], primaryDir);
    expect(forced.code).toBe(0);
    expect(JSON.parse(readFileSync(planPath, 'utf8')).items).toEqual({});
  });
});

describe('lane-stack e2e (#2394) — the --base trust boundary', () => {
  it('recheck rejects a --base that is not the recorded acquire point — a later base cannot shrink the certified diff', () => {
    expect(runStack(['init', `--plan=${planPath}`], primaryDir).code).toBe(0);
    expect(runStack(['plan-item', `--plan=${planPath}`, '--id=A', '--files=we:a.txt'], primaryDir).code).toBe(0);
    const laneA = makeLane('A', null);
    writeFile(laneA, 'shared.txt', 'base\nsneaky\n'); // undeclared edit in an EARLY commit
    commitAll(laneA, 'A: sneaky shared edit');
    const midSha = git(['rev-parse', 'HEAD'], laneA);
    writeFile(laneA, 'a.txt', 'a\n');
    commitAll(laneA, 'A: declared a');

    // --base=<the lane's own later commit> would hide the sneaky commit from the diff → hard exit 3.
    const bad = runStack(['recheck', `--plan=${planPath}`, '--id=A', `--base=${midSha}`], laneA);
    expect(bad.code, 'a self-attested wrong base must be rejected, never certified clean').toBe(3);
    expect(bad.json.detail).toMatch(/acquire point/);

    // The honest base works and the full actual set — sneaky edit included — is what gets certified.
    const good = runStack(['recheck', `--plan=${planPath}`, '--id=A', '--base=origin/main'], laneA);
    expect(good.code, good.err).toBe(0);
    expect(good.json.undeclared).toContain('we:shared.txt');
  });

  it('an option-shaped --base is rejected (exit 3) and never reaches git as an option (no always-pass diff)', () => {
    expect(runStack(['init', `--plan=${planPath}`], primaryDir).code).toBe(0);
    expect(runStack(['plan-item', `--plan=${planPath}`, '--id=A', '--files=we:a.txt'], primaryDir).code).toBe(0);
    const laneA = makeLane('A', null);
    writeFile(laneA, 'a.txt', 'a\n');
    commitAll(laneA, 'A: a');

    const evil = join(base, 'evil-output');
    const r = runStack(['recheck', `--plan=${planPath}`, '--id=A', `--base=--output=${evil}`], laneA);
    expect(r.code, 'an option-shaped base must hard-fail, not empty the diff').toBe(3);
    expect(r.json.detail).toMatch(/does not resolve/);
    expect(existsSync(evil), 'the injected --output never executed').toBe(false);
  });
});

describe('lane-stack e2e (#2394) — capability gate', () => {
  it('init reports supported:false against an origin WITHOUT the capability marker', () => {
    const noMarkerOrigin = join(base, 'no-marker.git');
    buildOrigin(noMarkerOrigin, false);
    const clone = join(base, 'no-marker-clone');
    git(['clone', '--quiet', noMarkerOrigin, clone]);

    const init = runStack(['init', `--plan=${join(base, 'plan-nomarker.json')}`], clone);
    expect(init.code, init.err).toBe(0);
    expect(init.json.supported, 'no marker on origin/main ⇒ hard default to plain siblings').toBe(false);
  });

  it('init reports supported:false when `git fetch origin` fails, even with a stale local marker', () => {
    // The marker IS on this clone's stale origin/main remote-tracking ref — but the fetch that would confirm
    // the CURRENT main fails (origin unreachable). Fail-open here would let a capability revoked on the real
    // main keep enabling stacking; the invariant is "default HARD to siblings on ANY read failure".
    const clone = join(base, 'stale-clone');
    git(['clone', '--quiet', originDir, clone]);
    expect(git(['rev-parse', '--verify', 'origin/main'], clone)).toBeTruthy(); // stale ref present locally
    git(['remote', 'set-url', 'origin', join(base, 'gone.git')], clone); // origin now unreachable

    const init = runStack(['init', `--plan=${join(base, 'plan-unfetchable.json')}`], clone);
    expect(init.code, init.err).toBe(0);
    expect(init.json.supported, 'fetch failure ⇒ hard default to plain siblings').toBe(false);
    expect(init.json.detail).toMatch(/fetch/);
  });
});

/**
 * @file scripts/__tests__/lane-drain.test.mjs
 * @description Unit proof of the pure planner in `scripts/lane-drain.mjs` — the deferred merge-queue drain's
 *   CORE slice (drain-one-couple, #2172 under #2162). `planDrain` decides ORDER (impl-first/WE-last),
 *   READINESS (cross-item blockedBy still queued → defer), and the resolve carrier from a manifest + the
 *   queued token; `buildPrLandArgs` builds the pr-land invocation. The git/pr-land driver is the I/O boundary.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  planDrain, buildPrLandArgs, planWatch, planPostDrain, resolveReachableFromBody,
  requiredCheckState, isRequiredTestGreen, convergenceLoopEnabled, convergenceEligible,
  CONVERGENCE_LOOP_DEFAULT_ENABLED, REQUIRED_CHECK_FAIL_CONCLUSIONS,
} from '../lane-drain.mjs';
import { buildManifest } from '../readiness/lane-manifest.mjs';

const queued = (...nums) => ({ queued: nums.map((n) => ({ num: String(n).padStart(3, '0'), at: null })) });

describe('lane-drain planDrain (#2172 / #2162)', () => {
  it('orders repos impl-first / WE-last and marks WE the resolve carrier', () => {
    const m = buildManifest({ item: 2153, repos: [
      { repo: 'we', ref: 'lane/2153-we' },
      { repo: 'frontierui', ref: 'lane/2153-fui' },
    ] });
    const plan = planDrain(m, queued(2153));
    expect(plan.ok).toBe(true);
    expect(plan.ready).toBe(true);
    expect(plan.steps.map((s) => s.repo)).toEqual(['frontierui', 'we']); // impl first, WE last
    expect(plan.steps.map((s) => s.ref)).toEqual(['lane/2153-fui', 'lane/2153-we']);
    expect(plan.resolveRepo).toBe('we');
    expect(plan.steps.find((s) => s.repo === 'we').carriesResolve).toBe(true);
  });

  it('accepts a PROVISIONAL hash-keyed couple and its hash blockedBy (#2288 JIT numbering)', () => {
    // Before landing, an item is hash-keyed everywhere — manifest item, queue token, cross-item blockedBy.
    const m = buildManifest({ item: 'x7k2q9a', blockedBy: ['xbb000a'], repos: [
      { repo: 'we', ref: 'lane/x7k2q9a-we' },
      { repo: 'frontierui', ref: 'lane/x7k2q9a-fui' },
    ] });
    expect(m.item).toBe('x7k2q9a');           // hash preserved, not coerced to NaN
    expect(m.blockedBy).toEqual(['xbb000a']);  // hash edge preserved
    // Blocker still queued → defer; blocker gone from queue → ready.
    expect(planDrain(m, { queued: [{ num: 'x7k2q9a' }, { num: 'xbb000a' }] }).ready).toBe(false);
    const readyPlan = planDrain(m, { queued: [{ num: 'x7k2q9a' }] });
    expect(readyPlan.ok).toBe(true);
    expect(readyPlan.ready).toBe(true);
    expect(readyPlan.steps.map((s) => s.repo)).toEqual(['frontierui', 'we']);
  });

  it('a WE-only couple plans a single WE step', () => {
    const m = buildManifest({ item: 2172, repos: [{ repo: 'we', ref: 'lane/2172-we' }] });
    const plan = planDrain(m, queued(2172));
    expect(plan.ok).toBe(true);
    expect(plan.ready).toBe(true);
    expect(plan.steps).toEqual([{ repo: 'we', ref: 'lane/2172-we', carriesResolve: true }]);
  });

  it('refuses to drain an item that is NOT queued (nothing ready-to-merge)', () => {
    const m = buildManifest({ item: 2153, repos: [{ repo: 'we', ref: 'lane/2153-we' }] });
    const plan = planDrain(m, queued(9999)); // 2153 not in the queue
    expect(plan.ok).toBe(false);
    expect(plan.ready).toBe(false);
    expect(plan.errors.join(' ')).toMatch(/not queued/);
  });

  it('refuses an INVALID manifest (no WE / no resolve carrier) → ok:false with errors', () => {
    const m = buildManifest({ item: 2153, repos: [{ repo: 'frontierui', ref: 'lane/x', carriesResolve: false }] });
    const plan = planDrain(m, queued(2153));
    expect(plan.ok).toBe(false);
    expect(plan.errors.length).toBeGreaterThan(0);
  });

  it('DEFERS a couple whose cross-item blockedBy dependency is still queued (unlanded)', () => {
    const m = buildManifest({ item: 2162, repos: [{ repo: 'we', ref: 'lane/2162-we' }], blockedBy: [2172] });
    const plan = planDrain(m, queued(2162, 2172)); // 2172 still queued → not landed yet
    expect(plan.ok).toBe(true);
    expect(plan.ready).toBe(false);
    expect(plan.waitOn).toEqual(['2172']);
  });

  it('is READY once the blockedBy dependency has left the queue (landed)', () => {
    const m = buildManifest({ item: 2162, repos: [{ repo: 'we', ref: 'lane/2162-we' }], blockedBy: [2172] });
    const plan = planDrain(m, queued(2162)); // 2172 no longer queued → landed
    expect(plan.ready).toBe(true);
    expect(plan.waitOn).toEqual([]);
  });
});

describe('lane-drain buildPrLandArgs (#2172)', () => {
  it('builds a WE (primary) pr-land call — no --repo, --json by default', () => {
    expect(buildPrLandArgs({ ref: 'lane/2172-we' }))
      .toEqual(['scripts/pr-land.mjs', '--ref=lane/2172-we', '--json']);
  });
  it('adds --repo for a non-primary repo and forwards a body file + dry-run', () => {
    const args = buildPrLandArgs({ ref: 'lane/x-fui', repoPath: '/home/u/workspace/frontierui', bodyFile: '/tmp/b.md', dryRun: true });
    expect(args).toContain('--repo=/home/u/workspace/frontierui');
    expect(args).toContain('--body-file=/tmp/b.md');
    expect(args).toContain('--dry-run');
    expect(args[0]).toBe('scripts/pr-land.mjs');
  });
});

describe('lane-drain contract guard (source-level)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/lane-drain.mjs'), 'utf8');
  it('re-uses the shared transports (pr-land to land, push-if-green to publish) — never a raw work-merge / raw main push', () => {
    expect(src).toMatch(/pr-land\.mjs/);            // couples land via pr-land (the #2172 transport)
    expect(src).toMatch(/push-if-green\.mjs/);      // post-land housekeeping publishes via the sanctioned gated helper (#2175/#2073)
    // The forbidden RAW ops: a --no-ff work-merge (pr-land owns that) and a raw `git push origin main`.
    expect(src).not.toMatch(/'--no-ff'/);
    expect(src).not.toMatch(/\[\s*'push',\s*'origin',\s*'main'\s*\]/);
    // The only `git merge` allowed is a local ff-only SYNC (via `pull --ff-only`) — never a work-merge of a lane ref.
    expect(src).not.toMatch(/'merge',\s*'origin\/[^']*-/); // no `git merge origin/lane/<slug>-<n>` (a raw lane work-merge)
  });
  it('clears the queued marker only via backlog.mjs unqueue (the single clear point)', () => {
    expect(src).toMatch(/'unqueue'/);
  });
});

describe('lane-drain planWatch (#2173 — the outer monitor loop)', () => {
  const man = (item, opts = {}) => buildManifest({ item, repos: [{ repo: 'we', ref: `lane/${item}-we` }], ...opts });

  it('marks a queued couple with no blockers READY, ordered by num', () => {
    const q = queued(2175, 2173);
    const plan = planWatch(q, { '2173': man(2173), '2175': man(2175) });
    expect(plan.ready).toEqual(['2173', '2175']); // sorted
    expect(plan.deferred).toEqual([]);
    expect(plan.invalid).toEqual([]);
    expect(plan.unresolvable).toEqual([]);
  });

  it('DEFERS a couple whose cross-item blockedBy is still queued (chain head first)', () => {
    const q = queued(2173, 2174); // both queued; 2174 blockedBy 2173 (unlanded)
    const plan = planWatch(q, { '2173': man(2173), '2174': man(2174, { blockedBy: [2173] }) });
    expect(plan.ready).toEqual(['2173']);
    expect(plan.deferred).toEqual([{ num: '2174', waitOn: ['2173'] }]);
  });

  it('once the blocker has left the queue (landed), the dependent becomes READY (the cascade across passes)', () => {
    const q = queued(2174); // 2173 already drained → off the queue
    const plan = planWatch(q, { '2174': man(2174, { blockedBy: [2173] }) });
    expect(plan.ready).toEqual(['2174']);
    expect(plan.deferred).toEqual([]);
  });

  it('reports a queued item whose manifest could not be read (null) as unresolvable, never drained', () => {
    const q = queued(2173, 2175);
    const plan = planWatch(q, { '2173': man(2173), '2175': null });
    expect(plan.ready).toEqual(['2173']);
    expect(plan.unresolvable).toEqual(['2175']);
  });

  it('reports a queued item with an INVALID manifest as invalid (skip + report), never ready', () => {
    const q = queued(2173);
    // no WE repo / no resolve carrier → validateManifest fails
    const bad = buildManifest({ item: 2173, repos: [{ repo: 'frontierui', ref: 'lane/x', carriesResolve: false }] });
    const plan = planWatch(q, { '2173': bad });
    expect(plan.ready).toEqual([]);
    expect(plan.invalid.map((i) => i.num)).toEqual(['2173']);
    expect(plan.invalid[0].errors.length).toBeGreaterThan(0);
  });

  it('an empty queue plans nothing (idempotent no-op)', () => {
    const plan = planWatch(queued(), {});
    expect(plan).toEqual({ ready: [], deferred: [], invalid: [], unresolvable: [] });
  });
});

describe('lane-drain watch/drain contract guard (source-level)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/lane-drain.mjs'), 'utf8');
  it('drains ready couples by spawning drain-one — never re-implementing the land', () => {
    expect(src).toMatch(/'drain-one'/);
    expect(src).toMatch(/drainOneCouple/);
  });
  it('regenerates the WE derived-artifact set once (the Phase 4c relocation)', () => {
    expect(src).toMatch(/gen:inventory/);
    expect(src).toMatch(/gen:reference-index/);
  });
  it('guards against the land-but-unqueue-fail hot loop (never re-drains an attempted couple)', () => {
    expect(src).toMatch(/attempted/);
    expect(src).toMatch(/attempted\.has\(/);
  });
  it('exit status reflects whether the queue actually drained (not a stuck-queue exit-0)', () => {
    expect(src).toMatch(/fullyDrained/);
    expect(src).toMatch(/DRY_RUN \|\| fullyDrained \? 0 : 2/);
  });
});

describe('lane-drain planPostDrain (#2175 reopen-on-fail / manifest cleanup)', () => {
  it('a LANDED couple deletes its manifest, never reopens', () => {
    expect(planPostDrain({ landed: true })).toEqual({ deleteManifest: true, reopen: false });
  });
  it('a merge-failed couple REOPENS (stranded active→open), no manifest delete', () => {
    expect(planPostDrain({ landed: false, reason: 'merge-failed' })).toEqual({ deleteManifest: false, reopen: true });
  });
  it('a resolve-unreachable couple REOPENS too', () => {
    expect(planPostDrain({ landed: false, reason: 'resolve-unreachable' })).toEqual({ deleteManifest: false, reopen: true });
  });
  it('a NOT-ready defer / dry-run / bad input reconciles nothing (never touched main)', () => {
    expect(planPostDrain({ landed: false, reason: 'not-ready' })).toEqual({ deleteManifest: false, reopen: false });
    expect(planPostDrain({ landed: false, reason: 'dry-run' })).toEqual({ deleteManifest: false, reopen: false });
    expect(planPostDrain({ landed: false, reason: 'plan-invalid' })).toEqual({ deleteManifest: false, reopen: false });
    expect(planPostDrain(null)).toEqual({ deleteManifest: false, reopen: false });
  });
});

describe('lane-drain resolveReachableFromBody — frontmatter-strict resolve read (#2603)', () => {
  const fm = (status) => `---\nbornAs: x7xs42w\nkind: task\nstatus: ${status}\n---\n\n# An item\n`;

  it('reads a genuinely frontmatter-resolved item as resolved', () => {
    expect(resolveReachableFromBody(fm('resolved'))).toBe(true);
  });

  it('reads a fenced-example SPOOF (OPEN item whose BODY carries a column-0 `status: resolved`) as NOT resolved', () => {
    // The exact #2455/#2603 spoof: frontmatter says open, prose shows a fenced frontmatter example. The old
    // loose `/^status:\s*resolved/m` over the full body matched the prose line and read TRUE (fails OPEN on
    // the drain). The frontmatter-strict read only sees the real `status: open`.
    const spoof = `---\nkind: task\nstatus: open\n---\n\nExample frontmatter you might write:\n\n\`\`\`\nstatus: resolved\n\`\`\`\n`;
    // sanity: the loose reader this replaced WOULD have been fooled here
    expect(/^status:\s*resolved/m.test(spoof)).toBe(true);
    expect(resolveReachableFromBody(spoof)).toBe(false);
  });

  it('fails CLOSED on inputs with no readable status (no frontmatter / bad read → not resolved)', () => {
    expect(resolveReachableFromBody('no frontmatter here\nstatus: resolved in prose\n')).toBe(false);
    expect(resolveReachableFromBody(fm('open'))).toBe(false);
    expect(resolveReachableFromBody('')).toBe(false);
  });

  it('returns null (couldn’t determine — advisory) when the body is absent', () => {
    // A null body is git-show-failed, distinct from a hard "not resolved" false — the caller still unqueues on
    // null (advisory) but never on false.
    expect(resolveReachableFromBody(null)).toBe(null);
    expect(resolveReachableFromBody(undefined)).toBe(null);
  });
});

describe('lane-drain requiredCheckState — the single-sourced required-`test` classifier (#2410 slice D)', () => {
  it('SUCCESS → green (landable)', () => {
    expect(requiredCheckState('SUCCESS')).toBe('green');
    expect(requiredCheckState('success')).toBe('green'); // case-insensitive
    expect(isRequiredTestGreen('SUCCESS')).toBe(true);
  });
  it('every definitive FAIL conclusion → red (never land)', () => {
    for (const c of REQUIRED_CHECK_FAIL_CONCLUSIONS) {
      expect(requiredCheckState(c)).toBe('red');
      expect(isRequiredTestGreen(c)).toBe(false);
    }
  });
  it('anything else (null / pending / neutral / in-progress) → pending, and NOT green (fails closed)', () => {
    for (const c of [null, undefined, '', 'PENDING', 'NEUTRAL', 'IN_PROGRESS', 'QUEUED']) {
      expect(requiredCheckState(c)).toBe('pending');
      expect(isRequiredTestGreen(c)).toBe(false);
    }
  });
});

describe('lane-drain convergence loop switch — off by default, opt-in, scoped to small/non-security (#2410 slice D)', () => {
  it('is OFF by default (no flag, no env)', () => {
    expect(CONVERGENCE_LOOP_DEFAULT_ENABLED).toBe(false);
    expect(convergenceLoopEnabled({})).toBe(false);
    expect(convergenceLoopEnabled()).toBe(false);
  });
  it('an explicit --converge flag turns it on; --converge=false forces it off (flag wins over env)', () => {
    expect(convergenceLoopEnabled({ flag: true })).toBe(true);
    expect(convergenceLoopEnabled({ flag: false, env: '1' })).toBe(false); // explicit off beats env-on
  });
  it('the WE_CONVERGENCE_LOOP env turns it on when no flag is given', () => {
    for (const v of ['1', 'true', 'on', 'YES']) expect(convergenceLoopEnabled({ env: v })).toBe(true);
    for (const v of ['0', 'false', 'off', '']) expect(convergenceLoopEnabled({ env: v })).toBe(false);
  });
  it('a disabled loop is never eligible, whatever the diff', () => {
    const r = convergenceEligible({ enabled: false, signals: {} });
    expect(r.eligible).toBe(false);
    expect(r.reasons[0]).toMatch(/off by default/);
  });
  it('an enabled loop over a small non-security diff IS eligible', () => {
    expect(convergenceEligible({ enabled: true, signals: {} }).eligible).toBe(true);
    expect(convergenceEligible({ enabled: true, signals: { dismissedFindings: 1, crossRepo: true } }).eligible).toBe(true); // those aren't the scoped-out set
  });
  it('a security (blast-radius / gate-self / statute) or a large (size) diff is scoped OUT even when enabled', () => {
    for (const sig of ['blastRadius', 'gateSelf', 'statute', 'size']) {
      const r = convergenceEligible({ enabled: true, signals: { [sig]: true } });
      expect(r.eligible).toBe(false);
      expect(r.reasons.join(' ')).toMatch(new RegExp(sig));
    }
  });
});

describe('lane-drain reopen-on-fail contract guard (source-level, #2175)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/lane-drain.mjs'), 'utf8');
  it('reopens a stranded item via release --force (preserving queue + refs), never deletes a ref on failure', () => {
    expect(src).toMatch(/reopenStrandedItem/);
    expect(src).toMatch(/'release', num, '--force'/);
    // failure paths never delete a lane/* ref (refs are preserved for the next drain pass)
    expect(src).not.toMatch(/push[^\n]*--delete/);
  });
  it('deletes the lane manifest from main on a successful land (post-land cleanup)', () => {
    expect(src).toMatch(/finalizeLand/);
    expect(src).toMatch(/'rm', '--quiet', MANIFEST_FILENAME/);
  });
  it('scopes every reconcile commit to an explicit -- <pathspec> (never a bare commit that sweeps foreign staged hunks)', () => {
    expect(src).not.toMatch(/'add', '-A'/);
    // both reconcile commits pass a '--' pathspec separator (the shared-index-race guard)
    const commitCalls = src.match(/\['commit', '-m',[^\]]*\]/g) || [];
    expect(commitCalls.length).toBeGreaterThan(0);
    for (const c of commitCalls) expect(c).toMatch(/'--'/);
  });
});

describe('lane-drain on-land cleanup contract guard (source-level, #2748)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/lane-drain.mjs'), 'utf8');

  it('RELEASE-ON-LAND: releases the item lease across every pool via lane-pool by-item, on the success path', () => {
    expect(src).toMatch(/releaseItemLeases/);
    // the by-ITEM cross-pool sweep (#2748), not a by-session call the drain can't key without the slug
    expect(src).toMatch(/'release', '--all-pools', `--item=\$\{Number\(num\)\}`/);
    // it is invoked only AFTER finalizeLand (the success reconcile), never on a failed/not-ready path
    const finIdx = src.indexOf('const fin = finalizeLand(CWD, num)');
    const relIdx = src.indexOf('releaseItemLeases(CWD,');
    expect(finIdx).toBeGreaterThan(-1);
    expect(relIdx).toBeGreaterThan(finIdx);
  });

  it('RESOLVE-ON-LAND: the drain owns the flip, kept WE-last + frontmatter-strict, only when not pre-resolved', () => {
    expect(src).toMatch(/resolveLandedItem/);
    // flips via backlog.mjs resolve (legal from active OR open) — no --force that would resolve an epic over kids
    expect(src).toMatch(/'resolve', num\b/);
    expect(src).not.toMatch(/'resolve', num, '--force'/);
    // #2899 A2 — the flip is attempted on a `false` OR a `null` (couldn't-tell) verdict, never only on `false`:
    // couldn't-tell was the NORMAL verdict for a freshly JIT-numbered card, and the old `=== false` guard
    // skipped it with no attempt and no warning. Scrape the CODE line, not the prose: the previous version of
    // this assertion searched for `if (resolveReachable === false)` and kept passing after the guard changed,
    // because that string survived inside an explanatory COMMENT. A source scrape must anchor on something a
    // comment cannot satisfy.
    const codeLines = src.split('\n').filter((l) => !l.trim().startsWith('//') && !l.trim().startsWith('*'));
    const guardLine = codeLines.findIndex((l) => l.includes('if (resolveReachable !== true)'));
    expect(guardLine, 'the flip must be attempted on false OR null, not only false').toBeGreaterThan(-1);
    expect(codeLines.some((l) => l.includes('if (resolveReachable === false)') && l.includes('const flip'))).toBe(false);
    const flipCall = src.indexOf('resolveLandedItem(CWD, num)');
    expect(flipCall).toBeGreaterThan(-1);
  });

  it('#2899 jury J1 — `flipped` means the flip is a COMMIT, so a failed commit is never reported as resolved', () => {
    // The shipped version returned `flipped: true` whenever `backlog.mjs resolve` succeeded, regardless of
    // whether the scoped commit landed — and both call sites branch on `flipped`. A failed commit therefore
    // printed `✓ resolved on land … + pushed to main` while the card was untouched on main: a silent false
    // success on the sole writer to main, which is the exact failure class #2899 was filed to close.
    expect(src).toMatch(/return \{ flipped: committed,/);
    expect(src).not.toMatch(/return \{ flipped: true, alreadyResolved: false, committed \}/);
    // and the commit result is what feeds it — not a hardcoded literal
    expect(src).toMatch(/const committed = quietGit\(CWD, \['commit'/);
  });

  it('resolve-on-land runs AFTER every ref merged (WE-last), so a failed impl half never false-resolves (#96)', () => {
    // the resolve flip lives below the impl-first/WE-last merge loop, not inside/above it
    const mergeLoop = src.indexOf('for (const step of plan.steps)');
    const flipCall = src.indexOf('resolveLandedItem(CWD, num)');
    expect(mergeLoop).toBeGreaterThan(-1);
    expect(flipCall).toBeGreaterThan(mergeLoop);
    // still reads status FRONTMATTER-strict (never a loose body read) for the reachability gate
    expect(src).toMatch(/resolveReachableFromBody/);
  });

  it('every on-land cleanup commit is scoped to an explicit -- <pathspec> (shared-index-race guard)', () => {
    const commitCalls = src.match(/\['commit', '-m',[^\]]*\]/g) || [];
    for (const c of commitCalls) expect(c).toMatch(/'--'/);
  });
});

describe('lane-drain whole-process lease heartbeat (#2453 — per-couple, not just per-pass)', () => {
  const src = readFileSync(resolve(process.cwd(), 'scripts/lane-drain.mjs'), 'utf8');
  it('heartbeats the lease inside the per-couple drain loop, not only at the top of a watch pass', () => {
    const heartbeatCalls = src.match(/heartbeatDrainLease\(DRAIN_LOCK_ROOT, leaseOwner\)/g) || [];
    // #2391 kept ONE call at the top of the watch loop; #2453 adds a SECOND inside onePass's per-couple
    // for-loop so a single pass that runs long (many couples, each waiting on GitHub checks) never goes
    // stale mid-sweep — a pass-boundary-only heartbeat is provably insufficient for that case.
    expect(heartbeatCalls.length).toBeGreaterThanOrEqual(2);
    // The per-couple call site must live INSIDE the `for (const num of toDrain)` loop body, i.e. between
    // the loop's opening brace and drainOneCouple's invocation — not merely present anywhere in the file.
    const loopStart = src.indexOf('for (const num of toDrain)');
    const drainCall = src.indexOf('drainOneCouple(CWD, num, mpath, bodyFile)');
    const heartbeatInLoop = src.indexOf('heartbeatDrainLease(DRAIN_LOCK_ROOT, leaseOwner)', loopStart);
    expect(loopStart).toBeGreaterThan(-1);
    expect(heartbeatInLoop).toBeGreaterThan(loopStart);
    expect(heartbeatInLoop).toBeLessThan(drainCall);
  });
  it('the per-couple heartbeat is still gated on !DRY_RUN (a dry-run never touches the lease)', () => {
    const loopStart = src.indexOf('for (const num of toDrain)');
    const loopBody = src.slice(loopStart, src.indexOf('drainOneCouple(CWD, num, mpath, bodyFile)', loopStart));
    expect(loopBody).toMatch(/if \(!DRY_RUN\) heartbeatDrainLease/);
  });
});

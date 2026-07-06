#!/usr/bin/env node
/**
 * lane-resume.mjs — discover STUCK ready-to-merge lanes and plan their takeover (#2200).
 *
 * The consumer side of a recurring situation: a producer (`/workflow`, `/batch`) opens a
 * `ready-to-merge` PR per item, but some never land — a conflict with a peer that landed first, a red
 * required `test` (the lane shipped a real bug), or a `blockedBy` item that isn't landed yet. `/drain`
 * only lands couples that are ALREADY ready; it skips these. This engine finds them, says WHY each is
 * stuck, and orders them so the `/resume` skill can hand each to a finisher subagent (seeded with the
 * EXISTING lane ref — reuse the ~done work, repair only the broken part) and then land it via the
 * normal drain transport.
 *
 * Subcommands:
 *   node scripts/lane-resume.mjs discover [--json]     # classify + blockedBy-order every stuck lane
 *   node scripts/lane-resume.mjs land <pr> [--dry-run] [--json]   # land ONE stuck lane PR (#2202)
 *
 * LAND (#2202, #2290) — the durable, tested version of the 2026-07-03 scratchpad plumbing. Reuses the ONE #2198
 * rebase-drop-manifest helper (`scripts/lib/rebase-drop-manifest.mjs`, shared with the label lander): for a PR
 * whose required `test` is green but which is only CONFLICTING/BEHIND, it rebuilds the tip onto main (manifest
 * dropped) via pure plumbing — no branch checkout. #2290: lane-resume NO LONGER merges directly — the drain is
 * the sole writer to main. Instead it ENQUEUES (ensures the `ready-to-merge` label) and TRIGGERS a single-couple
 * drain pass (`merge-ai-prs.mjs --only=<pr>`) that lands the recovered lane through the shared gate. A red `test`
 * (a real bug) or a real (non-manifest) conflict is NOT enqueued — the finisher repairs code first. `UNSTABLE` +
 * `test=pass` IS mergeable (only `test` is required; `cla`/Workers-Builds are non-required). So `/finish` =
 * discover-then-repair-then-`land` (enqueue + trigger the drain, which shares the same helper).
 *
 * Guard-safe: read-only `discover` (git show / gh list); `land` only pushes to a `lane/*` ref (the #1934
 * carve-out) + labels/triggers the drain — never a branch checkout, never a direct `gh pr merge` (any such
 * merge would be rejected by `scripts/lib/pr-merge-gate.mjs`). Fails soft — a PR whose manifest can't be read is
 * reported as `unknown`, never crashes the plan.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { rebaseDropManifest, gitRunner } from './lib/rebase-drop-manifest.mjs';

const READY_LABEL = 'ready-to-merge';

// ─────────────────────────── pure logic (exported, unit-tested) ───────────────────────────

/**
 * Classify ONE lane's takeover disposition from its already-collected signals.
 * @param {{num:number, mergeable:string, mergeState:string, testConclusion:string|null,
 *          item:number|null, repos:Array<{repo:string,ref:string,carriesResolve?:boolean}>,
 *          blockedBy:number[]}} pr
 * @param {Set<number>} resolvedItems — items whose backlog file is status:resolved on main (blocker landed)
 * @returns {{num, item, repos, blockedBy, crossRepo, disposition, reason}}
 *   disposition ∈ 'ready' | 'conflict' | 'test-red' | 'blocked' | 'unknown'
 */
export function classifyLane(pr, resolvedItems) {
  const blockedBy = pr.blockedBy || [];
  const unlanded = blockedBy.filter((b) => !resolvedItems.has(b));
  const crossRepo = (pr.repos || []).some((r) => r.repo && r.repo !== 'we');
  const base = { num: pr.num, item: pr.item ?? null, repos: pr.repos || [], blockedBy, crossRepo };

  // BLOCKED wins: a finisher cannot land a lane whose blocker isn't on main yet (impl-first / dep-first).
  if (unlanded.length) return { ...base, disposition: 'blocked', reason: `blockedBy not landed: ${unlanded.join(',')}` };

  // A red required check means the lane shipped a real bug — the finisher must FIX code, not just rebase.
  if (pr.testConclusion && String(pr.testConclusion).toUpperCase() === 'FAILURE')
    return { ...base, disposition: 'test-red', reason: 'required `test` check is red (lane bug to fix)' };

  // A conflict is repairable by rebase-onto-main + resolve (+ regen derived artifacts) — mechanical.
  if (pr.mergeable === 'CONFLICTING' || pr.mergeState === 'DIRTY')
    return { ...base, disposition: 'conflict', reason: 'conflicts with main (rebase + resolve)' };

  // Clean + green ⇒ not stuck at all; `/drain` will take it. Surfaced so the plan is complete.
  if (pr.mergeable === 'MERGEABLE' && (!pr.testConclusion || String(pr.testConclusion).toUpperCase() === 'SUCCESS'))
    return { ...base, disposition: 'ready', reason: 'clean + green — `/drain` lands it' };

  return { ...base, disposition: 'unknown', reason: `mergeable=${pr.mergeable} state=${pr.mergeState} test=${pr.testConclusion ?? '—'}` };
}

/**
 * Order lanes so a lane never precedes a lane it is blockedBy (topological within the stuck set).
 * `blocked` lanes (blocker not landed at all) sort last — they can't run this pass. Ties keep PR order.
 * @param {ReturnType<typeof classifyLane>[]} lanes
 */
export function orderByBlockedBy(lanes) {
  const byItem = new Map(lanes.filter((l) => l.item != null).map((l) => [l.item, l]));
  const seen = new Set();
  const out = [];
  const visit = (l, stack) => {
    if (seen.has(l.num) || stack.has(l.num)) return; // cycle-safe: a back-edge is just skipped
    stack.add(l.num);
    for (const b of l.blockedBy) { const dep = byItem.get(b); if (dep) visit(dep, stack); }
    stack.delete(l.num);
    if (!seen.has(l.num)) { seen.add(l.num); out.push(l); }
  };
  for (const l of lanes) visit(l, new Set());
  // stable partition: attemptable (ready/conflict/test-red/unknown) before blocked
  return [...out.filter((l) => l.disposition !== 'blocked'), ...out.filter((l) => l.disposition === 'blocked')];
}

/**
 * Decide how to land ONE lane PR from its GitHub signals (#2202). Pure. Only the required `test` check gates —
 * `UNSTABLE` (a non-required check like `cla`/Workers-Builds red) is still mergeable.
 *   'red'       — required `test` failed → NEVER land (a real bug; the finisher fixes code first).
 *   'not-green' — required `test` not reported / still pending → wait (no land yet).
 *   'clean'     — test green + mergeable → `gh pr merge` directly.
 *   'rebuild'   — test green but CONFLICTING/DIRTY/BEHIND → rebase-drop the manifest, then merge.
 * @param {{mergeable:string, mergeState:string, testConclusion:string|null}} sig
 */
export function landDecision({ mergeable, mergeState, testConclusion } = {}) {
  const test = String(testConclusion || '').toUpperCase();
  const FAIL = ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ERROR', 'ACTION_REQUIRED', 'STARTUP_FAILURE'];
  if (FAIL.includes(test)) return { action: 'red', reason: `required \`test\` check is ${test.toLowerCase()}` };
  if (test !== 'SUCCESS') return { action: 'not-green', reason: `required \`test\` check not green (${test.toLowerCase() || 'none'})` };
  const m = String(mergeable || '').toUpperCase();
  const s = String(mergeState || '').toUpperCase();
  if (m === 'CONFLICTING' || s === 'DIRTY' || s === 'BEHIND') return { action: 'rebuild', reason: `test green but not up-to-date (mergeable=${m || '?'} state=${s || '?'}) — rebase-drop the manifest` };
  return { action: 'clean', reason: 'required check green + mergeable' };
}

/**
 * Land ONE stuck lane PR (#2202, #2290): repair-then-ENQUEUE. Reuses the #2198 `rebaseDropManifest` helper.
 * #2290 — lane-resume no longer merges directly (the drain is the sole writer to main): after any needed
 * rebase-drop rebuild, it ensures the `ready-to-merge` label and triggers a single-couple drain pass
 * (`node <drainScript> --only=<pr>`) that lands the couple through the shared merge gate. Best-effort trigger —
 * a park/failure just leaves the PR labelled for the standalone drain. `run(cmd,args,opts)->{status,stdout,stderr}`,
 * `prInfo`, and `drainScript` are injectable so this is unit-testable without a live repo/GitHub. Returns a
 * verdict object (never throws on a git/gh non-zero).
 * @returns {{action:string, pr:(number|string), merged:boolean, reason:string, rebased?:boolean}}
 */
export function land({ prNum, run = gitRunner, prInfo = null, base = 'origin/main', dryRun = false, label = READY_LABEL, triggerDrain = true, drainScript = 'scripts/merge-ai-prs.mjs' } = {}) {
  if (prNum == null) return { action: 'error', merged: false, reason: 'no PR number (usage: lane-resume.mjs land <pr>)' };
  if (!prInfo) {
    const v = run('gh', ['pr', 'view', String(prNum), '--json', 'number,headRefName,mergeable,mergeStateStatus,statusCheckRollup']);
    try { prInfo = JSON.parse(v.stdout || '{}'); } catch { prInfo = {}; }
  }
  const laneRef = prInfo.headRefName;
  const testCheck = (prInfo.statusCheckRollup || []).find((c) => (c.name || c.context) === 'test');
  const decision = landDecision({ mergeable: prInfo.mergeable, mergeState: prInfo.mergeStateStatus, testConclusion: testCheck ? (testCheck.conclusion || testCheck.state || null) : null });

  if (decision.action === 'red') return { action: 'red', pr: prNum, merged: false, reason: decision.reason };
  if (decision.action === 'not-green') return { action: 'not-green', pr: prNum, merged: false, reason: decision.reason };
  if (!laneRef) return { action: 'error', pr: prNum, merged: false, reason: 'the PR has no head ref (gh pr view returned none)' };
  if (dryRun) return { action: decision.action, pr: prNum, merged: false, laneRef, reason: `dry-run: would ${decision.action === 'rebuild' ? 'rebase-drop the manifest then ' : ''}enqueue #${prNum} (${laneRef}) — label ${label} + trigger a single-couple drain` };

  let rebased = false;
  if (decision.action === 'rebuild') {
    const r = rebaseDropManifest({ laneRef, base, run });
    if (r.action === 'skip') return { action: 'skip', pr: prNum, merged: false, reason: r.reason, conflictPaths: r.conflictPaths };
    if (r.action === 'error') return { action: 'error', pr: prNum, merged: false, reason: r.reason };
    rebased = true;
  }
  // #2290 — ENQUEUE instead of merging: ensure the ready-to-merge label, then trigger a single-couple drain (the
  // sole writer to main lands it via the shared gate). Both are best-effort — a label race or a park/failure just
  // leaves the PR labelled for the standalone drain; lane-resume never itself calls `gh pr merge`.
  run('gh', ['pr', 'edit', String(prNum), '--add-label', label]);
  if (triggerDrain) run('node', [drainScript, `--only=${prNum}`, '--label', label, '--this-repo']);
  return { action: rebased ? 'rebuilt-enqueued' : 'enqueued', pr: prNum, merged: false, rebased, reason: rebased ? 'rebased onto main (manifest dropped), labelled + single-couple drain triggered' : 'labelled ready-to-merge + single-couple drain triggered' };
}

// ─────────────────────────────────── IO helpers ───────────────────────────────────

const sh = (cmd, args) => execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();
const shJSON = (cmd, args, dflt) => { try { return JSON.parse(sh(cmd, args) || 'null') ?? dflt; } catch { return dflt; } };

/** Read a lane's manifest off its head ref (origin). Returns {item, repos, blockedBy} or null. */
function readManifest(ref) {
  for (const rev of [`origin/${ref}`, ref]) {
    try {
      const m = JSON.parse(execFileSync('git', ['show', `${rev}:.lane-manifest.json`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }));
      return { item: m.item ?? null, repos: m.repos || [], blockedBy: m.blockedBy || [] };
    } catch { /* try next rev */ }
  }
  return null;
}

/** Item numbers whose backlog file is status:resolved on origin/main (a blocker counts as landed). */
function resolvedItemSet() {
  const set = new Set();
  let files = [];
  try { files = sh('git', ['ls-tree', '-r', '--name-only', 'origin/main']).split('\n').filter((f) => /^backlog\/\d+-/.test(f)); } catch { return set; }
  for (const f of files) {
    const n = Number((f.match(/^backlog\/(\d+)-/) || [])[1]);
    try {
      const head = execFileSync('git', ['show', `origin/main:${f}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).slice(0, 400);
      if (/^status:\s*resolved/m.test(head)) set.add(n);
    } catch { /* skip */ }
  }
  return set;
}

function discover(asJson) {
  execFileSync('git', ['fetch', 'origin', '--quiet'], { stdio: 'ignore' });
  const prs = shJSON('gh', ['pr', 'list', '--label', READY_LABEL, '--state', 'open', '--json', 'number,mergeable,mergeStateStatus,headRefName,statusCheckRollup', '--limit', '200'], []);
  const resolved = resolvedItemSet();
  const lanes = prs.map((p) => {
    const man = readManifest(p.headRefName) || { item: null, repos: [], blockedBy: [] };
    const test = (p.statusCheckRollup || []).find((c) => (c.name || c.context) === 'test');
    return classifyLane({
      num: p.number, mergeable: p.mergeable, mergeState: p.mergeStateStatus,
      testConclusion: test ? (test.conclusion || test.state || null) : null,
      item: man.item, repos: man.repos, blockedBy: man.blockedBy,
    }, resolved);
  });
  const ordered = orderByBlockedBy(lanes);
  const bucket = (d) => ordered.filter((l) => l.disposition === d);
  const result = {
    ok: true,
    counts: { ready: bucket('ready').length, conflict: bucket('conflict').length, testRed: bucket('test-red').length, blocked: bucket('blocked').length, unknown: bucket('unknown').length },
    ready: bucket('ready'), conflict: bucket('conflict'), testRed: bucket('test-red'), blocked: bucket('blocked'), unknown: bucket('unknown'),
    order: ordered.map((l) => ({ pr: l.num, item: l.item, disposition: l.disposition, crossRepo: l.crossRepo, blockedBy: l.blockedBy, reason: l.reason })),
  };
  if (asJson) { process.stdout.write(JSON.stringify(result, null, 2) + '\n'); return; }
  const line = (l) => `  ${l.disposition === 'ready' ? '✓' : l.disposition === 'blocked' ? '⊘' : '→'} #${l.num}${l.item ? ` (#${l.item})` : ''}${l.crossRepo ? ' [cross-repo]' : ''} — ${l.reason}`;
  process.stderr.write(`lane-resume · ${prs.length} labelled PR(s): ${JSON.stringify(result.counts)}\n`);
  for (const d of ['ready', 'conflict', 'test-red', 'blocked', 'unknown']) {
    const b = bucket(d); if (!b.length) continue;
    process.stderr.write(`\n${d.toUpperCase()} (${b.length}):\n${b.map(line).join('\n')}\n`);
  }
}

const IS_CLI = process.argv[1] && process.argv[1].endsWith('lane-resume.mjs');
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const positional = argv.filter((a) => !a.startsWith('--'));
  const cmd = positional[0] || 'discover';
  const asJson = argv.includes('--json');
  if (cmd === 'discover') discover(asJson);
  else if (cmd === 'land') {
    const prNum = positional[1];
    if (prNum == null) { process.stderr.write('usage: lane-resume.mjs land <pr> [--dry-run] [--json]\n'); process.exit(2); }
    execFileSync('git', ['fetch', 'origin', '--quiet'], { stdio: 'ignore' });
    // #2290 — resolve the drain script off this module's dir so `--only` works from any cwd.
    const drainScript = fileURLToPath(new URL('./merge-ai-prs.mjs', import.meta.url));
    const verdict = land({ prNum, dryRun: argv.includes('--dry-run'), drainScript });
    if (asJson) process.stdout.write(JSON.stringify(verdict, null, 2) + '\n');
    else process.stderr.write(`lane-resume land #${verdict.pr}: ${verdict.merged ? '✓ merged' : verdict.action} — ${verdict.reason}\n`);
    // 0 = enqueued / dry-run / clean / not-green (soft — the drain lands later); red/skip/error = 2.
    const soft = ['enqueued', 'rebuilt-enqueued', 'clean', 'rebuild', 'rebuilt-awaiting-ci', 'not-green'];
    process.exit(verdict.merged || soft.includes(verdict.action) ? 0 : 2);
  }
  else { process.stderr.write(`unknown subcommand: ${cmd}\nusage: lane-resume.mjs discover [--json] | land <pr> [--dry-run] [--json]\n`); process.exit(2); }
}

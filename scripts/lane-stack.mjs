#!/usr/bin/env node
/**
 * lane-stack.mjs — the serial-batch overlap-stacking CLI (#2394, under #2387 F1): the mechanical boundary
 * around the PURE planner `we:scripts/readiness/overlap-chain.mjs` (which owns the model — union-find
 * overlap chains on declared file-sets, frontier/bridge/depth-cap decisions, the push-time
 * `actual ⊆ declared` re-check). This script owns the fs + git the pure module refuses to: the scratch
 * plan file it round-trips between the batch's seams, the capability-marker read off `origin/main`
 * (#2393 — stack ONLY when the drain's proof-of-land gate is provably live; default HARD to siblings on
 * any read failure or version mismatch), and the `git diff --name-only <base>...HEAD` that recomputes an
 * item's ACTUAL touched set at push time.
 *
 * THE SERIAL-BATCH FLOW (who runs what, where — see the batch skill's "Overlap-stacked serial batch"):
 *   1. `init` ONCE at pack time (primary checkout — it reads `origin/main`) → writes the fresh plan file.
 *   2. `plan-item` per item, in work order, BEFORE acquiring its lane → the stacking decision: sibling
 *      (acquire plain, off origin/main) vs stacked (acquire `--base=<parent tip sha>`; a bridge also merges
 *      the other parents' PINNED tip shas — emitted as `mergeTips` — in-session, never the mutable lane
 *      refs). Emits the concrete acquire/manifest refs from the parents' recorded tips.
 *   3. `recheck` in the item's LANE CLONE after the resolve commit, BEFORE `pr-land` — asserts
 *      `actual ⊆ declared`. Exit 4 = `rebase-required`: rebase onto the printed frontier tip(s) in-session,
 *      re-gate, `apply-rebase`, re-run `recheck` (must exit 0) — NEVER push a mislabelled sibling.
 *   4. `record` after the push — stores the item's pushed tip (sha+ref) as the chain's new frontier.
 *      `drop` instead for a carried/gate-red item that opened no PR.
 *
 * Usage:
 *   node scripts/lane-stack.mjs init --plan=/tmp/stack-<slug>.json [--depth-cap=4] [--force] [--json]
 *   node scripts/lane-stack.mjs plan-item --plan=<file> --id=2394 --files=we:a.mjs,we:b.md [--repo=we] [--json]
 *   node scripts/lane-stack.mjs recheck --plan=<file> --id=2394 --base=origin/main [--lane=<path>] [--repo=we] [--json]
 *   node scripts/lane-stack.mjs apply-rebase --plan=<file> --id=2394 --onto=2391 --base=<frontier tip sha> [--repo=we]
 *   node scripts/lane-stack.mjs record --plan=<file> --id=2394 --base=<ref> --tip-ref=lane/<slug>-2394 [--lane=<path>] [--repo=we]
 *   node scripts/lane-stack.mjs drop --plan=<file> --id=2394
 *   node scripts/lane-stack.mjs couple-open --impl-repo=frontierui --impl-ref=lane/2684-fui [--impl-tip=<sha>] [--we-ref=lane/2684-we] [--json]  # #2684 cross-locus couple overlap-open order + WE stack-base (stateless)
 *
 * TRUST BOUNDARY (#2394 review round 2): every git-facing input is validated, never interpolated raw —
 *   • `--base` must resolve to a commit via `rev-parse --verify` behind `--end-of-options` (a `-`-prefixed
 *     value can never be parsed as a git option — no `--output=…`-style always-pass injection), AND its
 *     effective diff base (`merge-base <base> HEAD` — what `<base>...HEAD` actually diffs from) must equal
 *     the plan's RECORDED acquire point. A self-attested wrong base can therefore never shrink the actual
 *     set the gate certifies.
 *   • sha pins fail LOUD: `record` refuses to store a tip without a resolvable HEAD sha, and `plan-item` /
 *     `apply-rebase` refuse to emit/accept a base that isn't a recorded pinned sha — never the mutable ref.
 *   • #2900 — the TREE the measurement runs on is validated too, not just the sha math on it. `recheck` /
 *     `record` refuse a PRIMARY-checkout cwd (they would diff `origin/main...origin/main`, certify an EMPTY
 *     actual set, and print the same success line as a real pass), refuse a base that resolves to HEAD (an
 *     empty diff is never a certification), and `--lane=<path>` is REAL — it used to be absorbed silently,
 *     which is what made a wrong-cwd invocation look deliberate. Unknown flags are now a hard error.
 *
 * Exit codes: 0 = ok; 3 = bad input / no plan; 4 = recheck verdict `rebase-required` (do NOT push).
 */
import { readFileSync, writeFileSync, existsSync, realpathSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { laneTreeVerdict } from './readiness/lane-tree-guard.mjs'; // #2900 — the positive "is this the item's leased lane" rule
import { LEASE_FILENAME } from './lib/lane-lease.mjs'; // #2900 — the marker lane-pool writes at acquire; the fact the old path guess was reaching for
import {
  createStackPlan, planNextItem, recheckAtPush, applyRebase, recordPushed, dropItem,
} from './readiness/overlap-chain.mjs';
import { planCoupleOpen } from './readiness/couple-plan.mjs'; // #2684 — the cross-locus couple's overlap-open order + WE stack-base (pure)
import { CAPABILITY_MARKER_PATH, readCapabilityFromMain } from './readiness/drain-capability.mjs';
import { writeAllSync } from './lib/write-all-sync.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
for (const a of rest) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
const AS_JSON = !!flags.json;

// #2900 A3 — an UNRECOGNISED flag is a hard error, never silently absorbed. The parser used to accept any
// `--key=value`, so the `--lane=<path>` in the observed incident was swallowed without a word: the operator
// had every reason to believe they had aimed the seam at the lane, and the tool measured the primary anyway.
// A flag that does nothing must SAY it does nothing. (`--lane` is real as of this change; the rest is the
// closed set the switch below actually reads.)
const KNOWN_FLAGS = Object.freeze({
  '*': ['plan', 'json', 'repo', 'lane'],                       // accepted everywhere
  init: ['depth-cap', 'force'],
  'plan-item': ['id', 'files'],
  recheck: ['id', 'base'],
  'apply-rebase': ['id', 'onto', 'base'],
  record: ['id', 'base', 'tip-ref'],
  drop: ['id'],
  'couple-open': ['id', 'impl-ref', 'impl-repo', 'impl-tip', 'we-ref', 'we-repo'],
});
function assertKnownFlags() {
  const allowed = new Set([...KNOWN_FLAGS['*'], ...(KNOWN_FLAGS[cmd] || [])]);
  const unknown = Object.keys(flags).filter((k) => !allowed.has(k));
  if (!unknown.length) return;
  const detail = `unknown flag(s) for \`${cmd}\`: ${unknown.map((u) => `--${u}`).join(', ')} — accepted: ${[...allowed].sort().map((a) => `--${a}`).join(', ')}. A silently-absorbed flag is how #2900 shipped a vacuous certification; there is no pass-through.`;
  // `fail` is defined below (function hoisting makes it callable here); keep the message shape identical.
  fail(detail);
}

function emit(result, code) {
  if (AS_JSON) writeAllSync(1, JSON.stringify(result, null, 2) + '\n');
  else process.stderr.write(`lane-stack ${result.ok === false ? '✗' : '✓'} ${result.detail}\n`);
  process.exit(code);
}
function fail(detail) { emit({ ok: false, detail }, 3); }

// #2900 — THE TREE THE MEASUREMENT RUNS ON. `--lane=<path>` is REAL (it was accepted and ignored, which is
// precisely what made the wrong-cwd invocation look deliberate and correct); absent it, the tree is the process
// cwd. Either way the path is reduced to git's OWN work-tree ROOT before anything judges or measures it — git
// discovers its repository by walking UP, so the directory you name and the repository it operates on are not
// necessarily the same place, and a guard that judges the raw string can be handed one and lied to by the other.
const id = flags.id != null ? String(flags.id) : null;
const LANE_FLAG = typeof flags.lane === 'string' && flags.lane ? resolve(flags.lane) : null;
if (flags.lane !== undefined && !LANE_FLAG) fail('--lane needs a path (--lane=<lane clone>), not a bare flag');
if (LANE_FLAG && !existsSync(LANE_FLAG)) fail(`--lane=${LANE_FLAG} does not exist`);

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', cwd: LANE_FLAG || process.cwd(), ...opts }).trim();
}

/** The WORK-TREE ROOT these seams measure — never a raw path string. Null when it is not a git work tree. */
function measuredTree() {
  const start = LANE_FLAG || process.cwd();
  try {
    const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { cwd: start, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
    return root ? realpathSync(root) : null;
  } catch { return null; }
}

/**
 * #2900 — REFUSE to operate on a tree that is not THIS item's leased lane clone.
 *
 * The first version of this guard asked whether the path contained `/.lanes/`. That guess failed twice: its
 * `script-in-lane` allowance made the refusal unreachable whenever the running copy of this script lived in a
 * lane clone — this repo's NORMAL execution context, so the guard was off exactly when it should fire — and a
 * substring test accepts any directory whose path merely contains `.lanes`.
 *
 * The pool already records the fact that guess was reaching for: `lane-pool.mjs acquire` writes a lease marker
 * at `<lane>/.git/.lane-lease` when it hands the folder out (the same file `guard-bash.mjs` reads, #2367). So
 * ask a POSITIVE question against a fact on disk — is this a leased lane, and is its lease for the item being
 * certified? — instead of inferring one from a name. That is the module's own "validated, not trusted" rule,
 * applied to the tree as it already is to `--base`. It also closes a hole the path guess could not: aiming
 * `--lane` at a DIFFERENT lane used to yield a full `clean` certification.
 */
function assertLaneTree(cmdName) {
  const tree = measuredTree();
  if (!tree) fail(`\`${cmdName}\`: ${LANE_FLAG || process.cwd()} is not a git work tree — nothing to measure (#2900)`);
  let lease = null;
  try { lease = JSON.parse(readFileSync(join(tree, '.git', LEASE_FILENAME), 'utf8')); } catch { lease = null; }
  const v = laneTreeVerdict({ lease, id });
  if (v.ok) return;
  fail(`\`${cmdName}\` measured ${tree} — ${v.detail}`);
}

const planPath = typeof flags.plan === 'string' ? resolve(flags.plan) : null;
// #2684 — `couple-open` is a STATELESS planning helper (the cross-locus couple's overlap-open order + WE
// stack-base): it needs no scratch plan file, so it is exempt from the `--plan` requirement below.
if (cmd !== 'couple-open' && !planPath) fail('pass --plan=<scratch plan file> (created by `init`, threaded through every seam)');

function loadPlan() {
  let text;
  try { text = readFileSync(planPath, 'utf8'); } catch { fail(`no plan at ${planPath} — run \`init\` first`); }
  try { return JSON.parse(text); } catch { fail(`plan at ${planPath} is not valid JSON`); }
}
function savePlan(plan) { writeFileSync(planPath, JSON.stringify(plan, null, 2) + '\n'); }

/** Resolve a caller-supplied ref/sha to a full commit sha, or null. `--end-of-options` keeps a `-`-prefixed
 *  value from ever being parsed as a git option (argument injection — see the TRUST BOUNDARY header). */
function resolveCommit(ref) {
  try { return git(['rev-parse', '--verify', '--quiet', '--end-of-options', `${ref}^{commit}`]) || null; }
  catch { return null; }
}

/** The plan's recorded acquire point for an item: the pinned sha stamped by `plan-item`/`apply-rebase`
 *  (stacked), or for a sibling — acquired off `origin/main` — the merge-base of HEAD with origin/main
 *  (robust to main having moved since acquire: the merge-base IS the acquire-time fork point). */
function recordedAcquireSha(item) {
  if (item.acquireBase) return item.acquireBase;
  const main = resolveCommit('origin/main');
  if (!main) fail('cannot resolve origin/main in this clone — needed to bind a sibling\'s --base to its acquire point');
  let mb = null;
  try { mb = git(['merge-base', main, 'HEAD']); } catch { /* no common ancestor */ }
  if (!mb) fail('HEAD shares no history with origin/main — cannot bind the sibling --base to an acquire point');
  return mb;
}

/** Recompute the item's ACTUAL touched set: `git diff --name-only <base>...HEAD` in cwd (the lane clone),
 *  repo-qualified with `--repo` (default `we`) to match the plan's declared-set qualification. The
 *  self-attested --base is NOT trusted: it must resolve to a commit, and its EFFECTIVE diff base
 *  (merge-base with HEAD — what `...` actually diffs from) must equal `expectedBaseSha`, the plan's
 *  recorded acquire point — a stale/typo'd/foreign base would silently shrink the certified actual set. */
function actualFiles(expectedBaseSha) {
  const base = typeof flags.base === 'string' && flags.base ? flags.base : null;
  if (!base) fail('pass --base=<ref> (the ref this lane was acquired at — origin/main for a sibling, the parent tip when stacked)');
  const baseSha = resolveCommit(base);
  if (!baseSha) fail(`--base=${base} does not resolve to a commit in this clone`);
  let effective = null;
  try { effective = git(['merge-base', baseSha, 'HEAD']); } catch { /* no common ancestor */ }
  if (!effective) fail(`--base=${base} shares no history with HEAD — not this lane's acquire point`);
  // #2900 A2 — a VACUOUS certification is impossible. Belt to A1's braces: if the effective diff base IS
  // HEAD, the lane has no commits of its own and `<base>...HEAD` is a no-op, so `actual` comes back EMPTY and
  // satisfies `actual ⊆ declared` trivially — the false pass, printed identically to a real one. This catches
  // the wrong-tree case even where the cwd heuristic cannot (a foreign clone, a lane reset to its base), and
  // it is a genuine error in its own right: there is nothing to certify.
  const headSha = resolveCommit('HEAD');
  if (headSha && effective === headSha) {
    fail(`--base=${base} resolves to the same commit as HEAD (${headSha.slice(0, 8)}) in ${measuredTree()} — the diff is empty, so this would certify NOTHING while printing success (#2900). Check you are measuring the lane clone (--lane=<path>) and that it carries its commits.`);
  }
  if (expectedBaseSha && effective !== expectedBaseSha) {
    fail(`--base=${base} would diff from ${effective.slice(0, 8)} but the plan's recorded acquire point is ${expectedBaseSha.slice(0, 8)} — pass the ref this lane was ACTUALLY acquired at (a wrong base shrinks the actual set the gate certifies)`);
  }
  const repo = typeof flags.repo === 'string' && flags.repo ? flags.repo : 'we';
  let out;
  try { out = git(['diff', '--name-only', '--end-of-options', `${baseSha}...HEAD`]); }
  catch (e) { fail(`git diff --name-only ${baseSha}...HEAD failed: ${String(e.message || e).split('\n')[0]}`); }
  return out.split('\n').map((s) => s.trim()).filter(Boolean).map((f) => `${repo}:${f}`);
}

assertKnownFlags();   // #2900 A3 — before any work, so a typo'd flag can never be absorbed into a certification

switch (cmd) {
  case 'init': {
    // Re-init guard (#2394 review round 2): `init` runs ONCE at pack time. A mid-batch re-init (crashed /
    // compacted session re-reading the skill) would silently erase every chain, frontier and capped flag the
    // push-time gate depends on — the next under-declared item would recheck against an EMPTY chain set and
    // ship as a certified-disjoint sibling, the exact artifact the exit-4 gate exists to block. So an
    // existing plan file is a hard error; `--force` is ONLY for a brand-new batch deliberately reusing the path.
    if (existsSync(planPath) && !flags.force) {
      fail(`a plan already exists at ${planPath} — init runs ONCE at pack time; re-initializing would erase the chain state the recheck gate depends on (pass --force ONLY for a brand-new batch deliberately reusing this path)`);
    }
    // The capability read (#2393/#2387 F4): `git show origin/main:<marker>` after a MANDATORY fetch, so the
    // verdict reflects the CURRENT main, never a stale local view. A failed fetch IS a read failure — the
    // invariant is "default HARD to siblings on ANY read failure", and a stale local `origin/main` can still
    // advertise a capability that was since revoked on the real main (fail-open). So: fetch failure, no
    // origin, no marker, malformed JSON, version below required — ALL ⇒ supported:false, plan pure siblings.
    let fetchError = null;
    // stdout must stay piped (the git() helper trims the returned string); only stderr is squelched.
    try { git(['fetch', 'origin', '--quiet'], { stdio: ['ignore', 'pipe', 'ignore'] }); }
    catch (e) { fetchError = String(e.message || e).split('\n')[0]; }
    const { marker, supported } = fetchError
      ? { marker: null, supported: false }
      : readCapabilityFromMain((p) => git(['show', `origin/main:${p}`]));
    const depthCap = flags['depth-cap'] != null ? Number(flags['depth-cap']) : undefined;
    const plan = createStackPlan({ supported, ...(Number.isInteger(depthCap) ? { depthCap } : {}) });
    savePlan(plan);
    emit({ ok: true, supported, gateVersion: marker ? marker.gateVersion : null, depthCap: plan.depthCap, plan: planPath, detail: `plan initialized at ${planPath} — stacking ${supported ? `ENABLED (gateVersion ${marker.gateVersion} on origin/main)` : `DISABLED (${fetchError ? `git fetch origin failed (${fetchError}) — cannot confirm the CURRENT main` : `no usable ${CAPABILITY_MARKER_PATH} on origin/main`} — plain siblings)`}` }, 0);
    break;
  }
  case 'plan-item': {
    if (!id) fail('pass --id=<item id>');
    if (typeof flags.files !== 'string') fail('pass --files=<comma-separated repo-qualified declared file-set> (e.g. we:scripts/x.mjs,we:backlog/2394-….md)');
    const plan = loadPlan();
    let decision;
    try { decision = planNextItem(plan, { id, files: flags.files.split(',').map((s) => s.trim()).filter(Boolean) }); }
    catch (e) { fail(String(e.message || e)); }
    const tips = decision.baseTips || {};
    // The acquire base is the parent's RECORDED tip SHA for this repo (`--repo`, default `we`), never the
    // mutable branch ref: the sha pins the child to the exact state the parent's push-time re-check audited.
    // A ref could be moved (a /finish takeover, any force-push) between record and acquire, and foreign
    // commits on both sides of the child's later `git diff <base>...HEAD` would vanish from its actual set —
    // invisible cargo past the actual⊆declared gate. `lane-pool acquire --base` accepts a raw sha. No sha ⇒
    // FAIL LOUD (#2394 review round 2): a ref fallback would be exactly the un-pinned acquire the pin exists
    // to prevent. Same rule for every BRIDGE merge parent — the producer merges these PINNED shas
    // (`mergeTips`) in-session, never `origin/lane/…`.
    const repo = typeof flags.repo === 'string' && flags.repo ? flags.repo : 'we';
    const tip = tips[repo] || null;
    let acquireBase = null;
    if (decision.stacked) {
      if (!tip || !tip.sha) fail(`parent #${decision.base} has no recorded tip sha for repo "${repo}" — cannot pin the acquire base (an un-pinned ref lets a moved branch smuggle foreign commits past the actual⊆declared gate); re-run \`record\` for the parent first`);
      acquireBase = tip.sha;
    }
    const mergeTips = {};
    for (const p of decision.mergeParents) {
      const pt = plan.items[p] && plan.items[p].tips && plan.items[p].tips[repo];
      if (!pt || !pt.sha) fail(`bridge parent #${p} has no recorded tip sha for repo "${repo}" — cannot pin its merge tip; re-run \`record\` for it first`);
      mergeTips[p] = plan.items[p].tips;
    }
    // Stamp the pinned acquire point on the item (null ⇒ sibling off origin/main): `recheck`/`record` bind
    // the self-attested --base to it — nothing persisted until every pin above validated.
    plan.items[decision.id].acquireBase = acquireBase;
    savePlan(plan);
    emit({
      ok: true, ...decision, acquireBase, mergeTips,
      detail: decision.stacked
        ? `#${id} STACKS on #${decision.base}${decision.mergeParents.length ? ` + merge PINNED tip(s) ${decision.mergeParents.map((p) => `#${p}=${mergeTips[p][repo].sha}`).join(', ')} in-session (never the mutable lane refs)` : ''} — acquire --base=${acquireBase} ; manifest --stack-parent=${decision.stackParents.join(' --stack-parent=')} --base=${acquireBase} (${repo})`
        : `#${id} is a SIBLING off origin/main (${decision.reason})`,
    }, 0);
    break;
  }
  case 'recheck': {
    if (!id) fail('pass --id=<item id>');
    assertLaneTree('recheck');   // #2900 A1 — never certify from the primary checkout
    const plan = loadPlan();
    const item = plan.items[id];
    if (!item) fail(`item ${id} is not in the plan`);
    let verdict;
    try { verdict = recheckAtPush(plan, { id, actualFiles: actualFiles(recordedAcquireSha(item)) }); }
    catch (e) { fail(String(e.message || e)); }
    // Read-only — nothing saved. Exit 4 on rebase-required so the skill/tests branch mechanically.
    emit({
      ok: verdict.ok, ...verdict,
      detail: verdict.ok
        ? `#${id} ${verdict.verdict}${verdict.undeclared.length ? ` (undeclared: ${verdict.undeclared.join(', ')}${verdict.verdict === 'undeclared-capped' ? ' — touches a depth-capped cluster; ships as the sibling it is, the drain pays the rebase' : ''})` : ''} — push`
        : `#${id} REBASE-REQUIRED — actual ⊄ declared and the excess (${verdict.undeclared.join(', ')}) overlaps chain frontier(s) #${verdict.onto.join(', #')}. Rebase onto the frontier tip IN-SESSION, re-gate, \`apply-rebase --onto=${verdict.onto.join(',')}\`, re-run recheck. NEVER push this as a certified-disjoint sibling.`,
    }, verdict.ok ? 0 : 4);
    break;
  }
  case 'apply-rebase': {
    if (!id) fail('pass --id=<item id>');
    assertLaneTree('apply-rebase');   // #2900 jury — the one seam that REWRITES history was unguarded while accepting --lane
    if (typeof flags.onto !== 'string' || !flags.onto) fail('pass --onto=<comma-separated frontier item ids> (from the recheck verdict)');
    if (typeof flags.base !== 'string' || !flags.base) fail('pass --base=<the frontier tip sha the lane was rebased onto> (the recheck verdict\'s ontoTips sha) — it re-pins the acquire point and recomputes the actuals');
    const plan = loadPlan();
    const item = plan.items[id];
    if (!item) fail(`item ${id} is not in the plan`);
    const onto = flags.onto.split(',').map((s) => s.trim()).filter(Boolean);
    const repo = typeof flags.repo === 'string' && flags.repo ? flags.repo : 'we';
    // The new base must be one of the ONTO parents' RECORDED tip shas — the exact frontier state the
    // verdict directed the rebase onto, never an arbitrary (or since-moved) ref: the same pinning rule as
    // plan-item's acquireBase (#2394 review round 2).
    const newBase = resolveCommit(flags.base);
    if (!newBase) fail(`--base=${flags.base} does not resolve to a commit in this clone`);
    const ontoTipShas = onto.map((p) => plan.items[p] && plan.items[p].tips && plan.items[p].tips[repo] && plan.items[p].tips[repo].sha).filter(Boolean);
    if (!ontoTipShas.includes(newBase)) fail(`--base=${flags.base} (${newBase.slice(0, 8)}) is not a recorded tip sha of the --onto parent(s) #${onto.join(', #')} — rebase onto the verdict's ontoTips sha and pass THAT`);
    item.acquireBase = newBase; // re-pin: recheck/record now bind --base to the rebased-onto frontier tip
    try { applyRebase(plan, { id, onto, actualFiles: actualFiles(newBase) }); }
    catch (e) { fail(String(e.message || e)); }
    savePlan(plan);
    const sp = plan.items[id].stackParents;
    emit({ ok: true, id, stackParents: sp, detail: `#${id} recorded as rebased onto #${flags.onto} — stackParents now [${sp.join(', ')}]; re-run recheck, then write the manifest with --stack-parent=${sp.join(' --stack-parent=')}` }, 0);
    break;
  }
  case 'record': {
    if (!id) fail('pass --id=<item id>');
    assertLaneTree('record');    // #2900 A1 — never pin the chain frontier from the primary checkout
    const plan = loadPlan();
    const item = plan.items[id];
    if (!item) fail(`item ${id} is not in the plan`);
    const repo = typeof flags.repo === 'string' && flags.repo ? flags.repo : 'we';
    // FAIL LOUD if HEAD won't resolve (#2394 review round 2): recording a sha-less tip would make the next
    // child's acquireBase fall through to the mutable lane ref — the exact un-pinned acquire the sha pin
    // exists to prevent. No sha, no record.
    let sha = null;
    try { sha = git(['rev-parse', 'HEAD']); }
    catch (e) { fail(`git rev-parse HEAD failed (${String(e.message || e).split('\n')[0]}) — refusing to record a tip without a pinned sha`); }
    if (!sha) fail('git rev-parse HEAD returned nothing — refusing to record a tip without a pinned sha');
    // The CLI is SINGLE-repo per couple (`--repo`, default `we`) — the one path the e2e suite proves. The
    // tips object stays repo-keyed to match the plan's repo-qualified file model; a multi-repo stacking
    // surface (if ever needed) must arrive with its own tests, not as an untested JSON side-door here.
    const tips = { [repo]: { sha, ...(typeof flags['tip-ref'] === 'string' ? { ref: flags['tip-ref'] } : {}) } };
    try { recordPushed(plan, { id, actualFiles: actualFiles(recordedAcquireSha(item)), tips }); }
    catch (e) { fail(String(e.message || e)); }
    savePlan(plan);
    emit({ ok: true, id, tips, detail: `#${id} recorded pushed — chain frontier advanced to it (tip ${tips[repo] && tips[repo].sha ? tips[repo].sha.slice(0, 8) : 'unknown'})` }, 0);
    break;
  }
  case 'drop': {
    if (!id) fail('pass --id=<item id>');
    const plan = loadPlan();
    try { dropItem(plan, { id }); }
    catch (e) { fail(String(e.message || e)); }
    savePlan(plan);
    emit({ ok: true, id, detail: `#${id} dropped (never pushed) — its declared files stay overlap-visible, no frontier change` }, 0);
    break;
  }
  case 'couple-open': {
    // #2684 — the cross-locus couple's OVERLAP-OPEN seam: decide open-order (impl-first, WE-last) + the WE
    // half's stack-base so BOTH PRs open before either lands (overlapped first CI). Stateless — the mechanical
    // boundary that resolves the impl lane's PUSHED tip to a PINNED sha and hands it to the pure planner
    // (`couple-plan.mjs`), which owns the model (stack-vs-serial, the fail-safe). The couple opener (`pr-land`)
    // shells this to learn WHERE to base the WE PR; the drain's impl-first/WE-last LAND order is untouched.
    // The impl tip is a PINNED sha (never the mutable lane ref): pass `--impl-tip=<sha>` directly, or
    // `--impl-ref=<ref>` to resolve it here via `rev-parse` (behind `--end-of-options`, same trust boundary as
    // every other ref this CLI resolves). A ref that will not resolve ⇒ no pinned sha ⇒ the planner fail-safes
    // to a plain (serial) WE open off main — never a stack on an unresolved base.
    if (typeof flags['impl-repo'] !== 'string' || !flags['impl-repo']) fail('pass --impl-repo=<impl repo slug> (frontierui | plateau-app)');
    let implTip = typeof flags['impl-tip'] === 'string' && flags['impl-tip'] ? flags['impl-tip'] : null;
    if (!implTip && typeof flags['impl-ref'] === 'string' && flags['impl-ref']) implTip = resolveCommit(flags['impl-ref']);
    const decision = planCoupleOpen({
      implRepo: flags['impl-repo'],
      weRepo: typeof flags['we-repo'] === 'string' && flags['we-repo'] ? flags['we-repo'] : 'we',
      implRef: typeof flags['impl-ref'] === 'string' ? flags['impl-ref'] : undefined,
      weRef: typeof flags['we-ref'] === 'string' ? flags['we-ref'] : undefined,
      implTipSha: implTip || undefined,
    });
    emit({ ok: true, ...decision, detail: decision.reason }, 0);
    break;
  }
  default:
    fail(`unknown command "${cmd || ''}" — one of: init | plan-item | recheck | apply-rebase | record | drop | couple-open`);
}

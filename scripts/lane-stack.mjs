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
 *   node scripts/lane-stack.mjs recheck --plan=<file> --id=2394 --base=origin/main [--repo=we] [--json]
 *   node scripts/lane-stack.mjs apply-rebase --plan=<file> --id=2394 --onto=2391 --base=<frontier tip sha> [--repo=we]
 *   node scripts/lane-stack.mjs record --plan=<file> --id=2394 --base=<ref> --tip-ref=lane/<slug>-2394 [--repo=we]
 *   node scripts/lane-stack.mjs drop --plan=<file> --id=2394
 *
 * TRUST BOUNDARY (#2394 review round 2): every git-facing input is validated, never interpolated raw —
 *   • `--base` must resolve to a commit via `rev-parse --verify` behind `--end-of-options` (a `-`-prefixed
 *     value can never be parsed as a git option — no `--output=…`-style always-pass injection), AND its
 *     effective diff base (`merge-base <base> HEAD` — what `<base>...HEAD` actually diffs from) must equal
 *     the plan's RECORDED acquire point. A self-attested wrong base can therefore never shrink the actual
 *     set the gate certifies.
 *   • sha pins fail LOUD: `record` refuses to store a tip without a resolvable HEAD sha, and `plan-item` /
 *     `apply-rebase` refuse to emit/accept a base that isn't a recorded pinned sha — never the mutable ref.
 *
 * Exit codes: 0 = ok; 3 = bad input / no plan; 4 = recheck verdict `rebase-required` (do NOT push).
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import {
  createStackPlan, planNextItem, recheckAtPush, applyRebase, recordPushed, dropItem,
} from './readiness/overlap-chain.mjs';
import { CAPABILITY_MARKER_PATH, readCapabilityFromMain } from './readiness/drain-capability.mjs';

const [cmd, ...rest] = process.argv.slice(2);
const flags = {};
for (const a of rest) {
  const m = a.match(/^--([^=]+)(?:=(.*))?$/);
  if (m) flags[m[1]] = m[2] === undefined ? true : m[2];
}
const AS_JSON = !!flags.json;

function emit(result, code) {
  if (AS_JSON) process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  else process.stderr.write(`lane-stack ${result.ok === false ? '✗' : '✓'} ${result.detail}\n`);
  process.exit(code);
}
function fail(detail) { emit({ ok: false, detail }, 3); }

function git(args, opts = {}) {
  return execFileSync('git', args, { encoding: 'utf8', ...opts }).trim();
}

const planPath = typeof flags.plan === 'string' ? resolve(flags.plan) : null;
if (!planPath) fail('pass --plan=<scratch plan file> (created by `init`, threaded through every seam)');

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
  if (expectedBaseSha && effective !== expectedBaseSha) {
    fail(`--base=${base} would diff from ${effective.slice(0, 8)} but the plan's recorded acquire point is ${expectedBaseSha.slice(0, 8)} — pass the ref this lane was ACTUALLY acquired at (a wrong base shrinks the actual set the gate certifies)`);
  }
  const repo = typeof flags.repo === 'string' && flags.repo ? flags.repo : 'we';
  let out;
  try { out = git(['diff', '--name-only', '--end-of-options', `${baseSha}...HEAD`]); }
  catch (e) { fail(`git diff --name-only ${baseSha}...HEAD failed: ${String(e.message || e).split('\n')[0]}`); }
  return out.split('\n').map((s) => s.trim()).filter(Boolean).map((f) => `${repo}:${f}`);
}

const id = flags.id != null ? String(flags.id) : null;

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
  default:
    fail(`unknown command "${cmd || ''}" — one of: init | plan-item | recheck | apply-rebase | record | drop`);
}

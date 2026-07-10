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
 *      (acquire plain, off origin/main) vs stacked (acquire `--base=<parent tip>`; a bridge also merges the
 *      other parents' tips in-session). Emits the concrete acquire/manifest refs from the parent's recorded
 *      tips.
 *   3. `recheck` in the item's LANE CLONE after the resolve commit, BEFORE `pr-land` — asserts
 *      `actual ⊆ declared`. Exit 4 = `rebase-required`: rebase onto the printed frontier tip(s) in-session,
 *      re-gate, `apply-rebase`, re-run `recheck` (must exit 0) — NEVER push a mislabelled sibling.
 *   4. `record` after the push — stores the item's pushed tip (sha+ref) as the chain's new frontier.
 *      `drop` instead for a carried/gate-red item that opened no PR.
 *
 * Usage:
 *   node scripts/lane-stack.mjs init --plan=/tmp/stack-<slug>.json [--depth-cap=4] [--json]
 *   node scripts/lane-stack.mjs plan-item --plan=<file> --id=2394 --files=we:a.mjs,we:b.md [--repo=we] [--json]
 *   node scripts/lane-stack.mjs recheck --plan=<file> --id=2394 --base=origin/main [--repo=we] [--json]
 *   node scripts/lane-stack.mjs apply-rebase --plan=<file> --id=2394 --onto=2391 --base=<new-base> [--repo=we]
 *   node scripts/lane-stack.mjs record --plan=<file> --id=2394 --base=<ref> --tip-ref=lane/<slug>-2394 [--repo=we]
 *   node scripts/lane-stack.mjs drop --plan=<file> --id=2394
 *
 * Exit codes: 0 = ok; 3 = bad input / no plan; 4 = recheck verdict `rebase-required` (do NOT push).
 */
import { readFileSync, writeFileSync } from 'node:fs';
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

/** Recompute the item's ACTUAL touched set: `git diff --name-only <base>...HEAD` in cwd (the lane clone),
 *  repo-qualified with `--repo` (default `we`) to match the plan's declared-set qualification. */
function actualFiles() {
  const base = typeof flags.base === 'string' && flags.base ? flags.base : null;
  if (!base) fail('pass --base=<ref> (the ref this lane was acquired at — origin/main for a sibling, the parent tip when stacked)');
  const repo = typeof flags.repo === 'string' && flags.repo ? flags.repo : 'we';
  let out;
  try { out = git(['diff', '--name-only', `${base}...HEAD`]); }
  catch (e) { fail(`git diff --name-only ${base}...HEAD failed: ${String(e.message || e).split('\n')[0]}`); }
  return out.split('\n').map((s) => s.trim()).filter(Boolean).map((f) => `${repo}:${f}`);
}

const id = flags.id != null ? String(flags.id) : null;

switch (cmd) {
  case 'init': {
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
    savePlan(plan);
    const tips = decision.baseTips || {};
    // The acquire base is the parent's RECORDED tip SHA for this repo (`--repo`, default `we`), never the
    // mutable branch ref: the sha pins the child to the exact state the parent's push-time re-check audited.
    // A ref could be moved (a /finish takeover, any force-push) between record and acquire, and foreign
    // commits on both sides of the child's later `git diff <base>...HEAD` would vanish from its actual set —
    // invisible cargo past the actual⊆declared gate. `lane-pool acquire --base` accepts a raw sha.
    const repo = typeof flags.repo === 'string' && flags.repo ? flags.repo : 'we';
    const tip = tips[repo] || null;
    const acquireBase = decision.stacked ? (tip && (tip.sha || tip.ref)) || null : null;
    emit({
      ok: true, ...decision, acquireBase,
      detail: decision.stacked
        ? `#${id} STACKS on #${decision.base}${decision.mergeParents.length ? ` + merge tips of #${decision.mergeParents.join(', #')}` : ''} — acquire --base=${acquireBase ?? '<parent tip>'} ; manifest --stack-parent=${decision.stackParents.join(' --stack-parent=')}${tips && Object.entries(tips).map(([r, t]) => (t && t.sha ? ` --base=${t.sha} (${r})` : '')).join('')}`
        : `#${id} is a SIBLING off origin/main (${decision.reason})`,
    }, 0);
    break;
  }
  case 'recheck': {
    if (!id) fail('pass --id=<item id>');
    const plan = loadPlan();
    let verdict;
    try { verdict = recheckAtPush(plan, { id, actualFiles: actualFiles() }); }
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
    const plan = loadPlan();
    try { applyRebase(plan, { id, onto: flags.onto.split(',').map((s) => s.trim()).filter(Boolean), actualFiles: flags.base ? actualFiles() : [] }); }
    catch (e) { fail(String(e.message || e)); }
    savePlan(plan);
    const sp = plan.items[id].stackParents;
    emit({ ok: true, id, stackParents: sp, detail: `#${id} recorded as rebased onto #${flags.onto} — stackParents now [${sp.join(', ')}]; re-run recheck, then write the manifest with --stack-parent=${sp.join(' --stack-parent=')}` }, 0);
    break;
  }
  case 'record': {
    if (!id) fail('pass --id=<item id>');
    const plan = loadPlan();
    const repo = typeof flags.repo === 'string' && flags.repo ? flags.repo : 'we';
    let sha = null;
    try { sha = git(['rev-parse', 'HEAD']); } catch { /* recorded without a sha only if rev-parse fails */ }
    // The CLI is SINGLE-repo per couple (`--repo`, default `we`) — the one path the e2e suite proves. The
    // tips object stays repo-keyed to match the plan's repo-qualified file model; a multi-repo stacking
    // surface (if ever needed) must arrive with its own tests, not as an untested JSON side-door here.
    const tips = { [repo]: { sha, ...(typeof flags['tip-ref'] === 'string' ? { ref: flags['tip-ref'] } : {}) } };
    try { recordPushed(plan, { id, actualFiles: actualFiles(), tips }); }
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

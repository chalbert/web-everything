/**
 * @file scripts/conveyor/build-dispatch-policy.mjs
 * @description #3984 slice 1 — the build-dispatch daemon's DECLARED POLICY and its PURE planner.
 *
 * The standalone build-dispatch daemon (we:skills-src/conveyor/build-dispatch-daemon.mjs) asks the tick core
 * (we:scripts/conveyor/tick-core.mjs) which cleared items it may launch this tick (`decisions.spawnBuilds`) and
 * then runs this planner OVER that answer. The planner never re-derives a tick-core guard (lane exclusion,
 * scope-lease arbitration, TTLs, capacity) — it only ADDS the operator rules below as extra holds. An item the
 * tick core refused never reaches here as dispatchable; an item this planner holds is simply not dispatched this
 * tick and is re-planned next tick.
 *
 * THE OPERATOR RULES, as data (`BUILD_DISPATCH_POLICY`) — each row names who enforces it, so a rule that is
 * declared but not yet enforced by code is visible as such rather than silently assumed:
 *   - cap concurrent builds (default 3), counted over DURABLE in-flight evidence (claims + run records), so a
 *     daemon restart cannot reset the count;
 *   - landing freeze: hold every new build while open PRs exceed `maxOpenPrs`, or while any open PR carries a
 *     label that means "a daemon failed to move this PR" (`freezeLabels`);
 *   - scope check against every open PR's files, and hot-file serialisation: no two in-flight builds (or two
 *     picks in one tick) touch the same file;
 *   - branch names never start with a bare number (the delivery ref is `lane/<num>...`);
 *   - task-prefixed scratch files and draft-first PRs — declared here, enforced by the brief / PR #2813.
 *
 * PURE: no fs, no clock, no child_process. Every input is passed in; unit-tested in
 * we:scripts/conveyor/__tests__/build-dispatch-policy.test.mjs.
 */

import { normNum } from './queue-store.mjs';

/** The declared policy. Numbers are defaults; the daemon may override `maxConcurrentBuilds`/`maxOpenPrs` from
 *  flags, never the rule set itself. */
export const BUILD_DISPATCH_POLICY = Object.freeze({
  maxConcurrentBuilds: 3,
  maxOpenPrs: 12,
  // A PR stuck because a daemon did not move it. The three `*-stalled` labels are applied by
  // we:scripts/conveyor/review-status-tag.mjs today; `blocked:daemon-bug` is the operator's manual freeze.
  freezeLabels: Object.freeze([
    'review-status:fix-stalled',
    'review-status:ci-heal-stalled',
    'review-status:review-stalled',
    'blocked:daemon-bug',
  ]),
  rules: Object.freeze([
    { id: 'cap', text: 'at most maxConcurrentBuilds builds in flight', enforcedBy: 'build-dispatch-policy.mjs' },
    { id: 'landing-freeze', text: 'no new build while open PRs > maxOpenPrs or any open PR carries a freeze label', enforcedBy: 'build-dispatch-policy.mjs' },
    { id: 'scope-vs-open-prs', text: "a build whose scope overlaps an open PR's files waits for that PR", enforcedBy: 'build-dispatch-policy.mjs' },
    { id: 'hot-file', text: 'no two in-flight builds on the same file', enforcedBy: 'build-dispatch-policy.mjs' },
    { id: 'branch-name', text: 'a delivery branch never starts with a bare number', enforcedBy: 'build-dispatch-policy.mjs (checks the planned ref)' },
    { id: 'scratch-prefix', text: 'scratch files in the brief are task-prefixed', enforcedBy: 'delivery brief (follow-up card)' },
    { id: 'draft-first', text: 'agent PRs open as drafts and are promoted on green', enforcedBy: 'PR #2813' },
  ]),
});

/**
 * Split a repo-qualified scope entry (`plateau-app:src/x.ts`, `we:scripts/`) into `{ repo, path }`. An entry
 * with no known prefix is a WE path (the backlog's own convention). Returns `null` for an empty entry.
 * @param {string} entry
 */
export function parseScopeEntry(entry) {
  const s = String(entry ?? '').trim();
  if (!s) return null;
  const m = /^([A-Za-z0-9._-]+):(.*)$/.exec(s);
  const repo = m ? m[1] : 'we';
  const path = (m ? m[2] : s).replace(/^\.\//, '').trim();
  if (!path) return null;
  return { repo: repo === 'plateau' ? 'plateau-app' : repo, path };
}

/** Two paths overlap when equal, or when one is a directory prefix of the other (segment boundary). */
export function pathsOverlap(a, b) {
  const x = String(a).replace(/\/+$/, '');
  const y = String(b).replace(/\/+$/, '');
  if (!x || !y) return false;
  return x === y || y.startsWith(`${x}/`) || x.startsWith(`${y}/`);
}

/**
 * The first overlapping pair between two scope lists, or `null`. Both lists hold repo-qualified entries
 * (or `{repo,path}` objects); entries in different repos never overlap.
 */
export function firstScopeOverlap(scopeA, scopeB) {
  const as = (scopeA || []).map((e) => (typeof e === 'string' ? parseScopeEntry(e) : e)).filter(Boolean);
  const bs = (scopeB || []).map((e) => (typeof e === 'string' ? parseScopeEntry(e) : e)).filter(Boolean);
  for (const a of as) {
    for (const b of bs) {
      if (a.repo === b.repo && pathsOverlap(a.path, b.path)) return `${a.repo}:${a.path}`;
    }
  }
  return null;
}

/**
 * The branch-name rule: the first path segment of a ref must not start with a digit (`lane/2385-x` is fine,
 * `2385-x` is not — the drain reads a leading digit run as "this PR delivers card N").
 * @returns {{ok:boolean, reason:string|null}}
 */
export function branchRefPolicy(ref) {
  const r = String(ref ?? '').trim();
  if (!r) return { ok: false, reason: 'empty ref' };
  if (/^[0-9]/.test(r)) return { ok: false, reason: `ref ${JSON.stringify(r)} starts with a bare number` };
  return { ok: true, reason: null };
}

/** The ref a build of `num` publishes to (mirrors delivery-agent-brief.md step 8: `lane/<num><attempt>-<slug>`). */
export function plannedBuildRef(num) {
  return `lane/${normNum(num) || String(num)}-build`;
}

/**
 * Does an open PR deliver `num`? The delivery ref is `lane/<num>[attempt]-<slug>`; the digit run must end there
 * (so `lane/2385-x` matches 2385 but not 238).
 */
export function prDeliversNum(pr, num) {
  const key = normNum(num);
  if (!key) return false;
  const m = /^lane\/(\d+|x[0-9a-z]{6})[b-z]?-/i.exec(String(pr?.headRefName ?? ''));
  if (!m) return false;
  return normNum(m[1]) === key;
}

/**
 * Turn an open-PR list (per repo) into `{repo, number, files:[{repo,path}], labels:[string]}` rows.
 * @param {Array<{repo:string, prs:Array<object>}>} byRepo
 */
export function normalizeOpenPrs(byRepo) {
  const out = [];
  for (const { repo, prs } of byRepo || []) {
    for (const pr of prs || []) {
      out.push({
        repo,
        number: pr.number,
        headRefName: pr.headRefName ?? '',
        labels: (pr.labels || []).map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean),
        files: (pr.files || []).map((f) => ({ repo, path: String(f?.path ?? f ?? '') })).filter((f) => f.path),
      });
    }
  }
  return out;
}

/**
 * THE PLANNER. Given this tick's candidates (the tick core's `spawnBuilds`, each enriched with the item's
 * scope), the durable in-flight builds, and the open PRs, decide which to dispatch and why each other one waits.
 *
 * @param {object} o
 * @param {Array<{num:string, lane?:number, scope:string[]}>} o.candidates  in tick-core order
 * @param {Array<{num:string, scope:string[], source:string}>} o.inFlight   durable in-flight builds
 * @param {Array<{repo:string, number:number, files:Array, labels:string[], headRefName:string}>} o.openPrs
 * @param {number} [o.externalBuilding]  builds the tick core itself counts in flight (leased build lanes + live
 *   conveyor sessions). They carry no scope here — the tick core's own lane scope arbitration covers them — but
 *   they DO count toward the cap: `max(durable in-flight, externalBuilding)`, so the daemon's own builds (which
 *   also lease lanes) are never counted twice.
 * @param {{engaged:boolean, reason?:string}} [o.killSwitch]
 * @param {object} [o.policy]
 * @returns {{freeze:{frozen:boolean, reasons:string[]}, slots:number, dispatch:Array<object>, hold:Array<object>}}
 */
export function planBuildDispatch({
  candidates = [], inFlight = [], openPrs = [], externalBuilding = 0, killSwitch = { engaged: false }, policy = BUILD_DISPATCH_POLICY,
} = {}) {
  const hold = [];
  const dispatch = [];
  const freezeReasons = [];
  if (killSwitch?.engaged) freezeReasons.push(`kill switch engaged${killSwitch.reason ? ` (${killSwitch.reason})` : ''}`);
  if (openPrs.length > policy.maxOpenPrs) freezeReasons.push(`${openPrs.length} open PRs > maxOpenPrs ${policy.maxOpenPrs}`);
  const freezeSet = new Set(policy.freezeLabels || []);
  for (const pr of openPrs) {
    const hit = pr.labels.find((l) => freezeSet.has(l));
    if (hit) freezeReasons.push(`${pr.repo}#${pr.number} is labelled ${hit}`);
  }
  const frozen = freezeReasons.length > 0;

  // Dedupe in-flight by num (a claim and a run record for the same build are one build).
  const inFlightByNum = new Map();
  for (const f of inFlight) {
    const k = normNum(f.num);
    if (!k) continue;
    const prev = inFlightByNum.get(k);
    inFlightByNum.set(k, prev ? { ...prev, scope: [...new Set([...(prev.scope || []), ...(f.scope || [])])], source: `${prev.source}+${f.source}` } : { ...f, num: k });
  }
  const running = [...inFlightByNum.values()];
  const busy = Math.max(running.length, Number(externalBuilding) > 0 ? Number(externalBuilding) : 0);
  let slots = Math.max(0, policy.maxConcurrentBuilds - busy);
  const picked = [];

  for (const c of candidates) {
    const num = normNum(c.num);
    const base = { num, lane: c.lane ?? null };
    if (frozen) { hold.push({ ...base, rule: 'landing-freeze', reason: freezeReasons.join('; ') }); continue; }
    if (inFlightByNum.has(num)) { hold.push({ ...base, rule: 'in-flight', reason: `already in flight (${inFlightByNum.get(num).source})` }); continue; }
    const deliveringPr = openPrs.find((pr) => prDeliversNum(pr, num));
    if (deliveringPr) { hold.push({ ...base, rule: 'in-flight', reason: `${deliveringPr.repo}#${deliveringPr.number} already delivers it` }); continue; }
    const ref = branchRefPolicy(plannedBuildRef(num));
    if (!ref.ok) { hold.push({ ...base, rule: 'branch-name', reason: ref.reason }); continue; }
    if (!Array.isArray(c.scope) || c.scope.length === 0) { hold.push({ ...base, rule: 'scope-vs-open-prs', reason: 'no scope: cannot prove it is disjoint from open PRs' }); continue; }
    let blocked = null;
    for (const pr of openPrs) {
      const hit = firstScopeOverlap(c.scope, pr.files);
      if (hit) { blocked = { rule: 'scope-vs-open-prs', reason: `${hit} is in open PR ${pr.repo}#${pr.number}` }; break; }
    }
    if (!blocked) {
      for (const r of [...running, ...picked]) {
        const hit = firstScopeOverlap(c.scope, r.scope);
        if (hit) { blocked = { rule: 'hot-file', reason: `${hit} is already being built by #${r.num}` }; break; }
      }
    }
    if (blocked) { hold.push({ ...base, ...blocked }); continue; }
    if (slots <= 0) { hold.push({ ...base, rule: 'cap', reason: `${busy + picked.length} builds in flight (cap ${policy.maxConcurrentBuilds})` }); continue; }
    slots -= 1;
    const pick = { ...base, scope: c.scope, source: 'this-tick' };
    picked.push(pick);
    dispatch.push(pick);
  }
  return { freeze: { frozen, reasons: freezeReasons }, inFlight: running, busy, slots, dispatch, hold };
}

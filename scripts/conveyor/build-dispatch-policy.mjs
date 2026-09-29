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
 *   - wip-cap (#4353): cap OPEN ITEMS — build start until merge (durable in-flight ∪ delivered-by-open-PR),
 *     the UNION not the sum — separately from `maxConcurrentBuilds`, which only bounds machine load. An item
 *     stops counting the moment it is no longer in-flight AND no open PR delivers it (merged, or the PR closed).
 *   - landing freeze: hold every new build while open PRs exceed `maxOpenPrs`, or while any open PR carries a
 *     label that means "a daemon failed to move this PR" (`freezeLabels`);
 *   - scope check against every open PR's files, and hot-file serialisation: no two in-flight builds (or two
 *     picks in one tick) touch the same file;
 *   - branch names never start with a bare number (the delivery ref is `lane/<num>...`);
 *   - task-prefixed scratch files and draft-first PRs — declared here, enforced by the brief / PR #2813.
 *
 * `maxOpenPrs` vs `maxOpenItems` (#4353 task 4, decided from LIVE data 2026-09-28): kept as two distinct
 * thresholds, not folded into one. Live `openPrs` that day included
 * `lane/investigate-lane-reset` — a real open PR with no leading-digit delivery ref, so it counts toward
 * `maxOpenPrs` (total review/CI load this repo is carrying) but NOT toward `maxOpenItems` (backlog-card WIP).
 * The populations provably diverge in practice, so `maxOpenPrs` stays as the coarser "how much is open in this
 * repo at all" ceiling while `maxOpenItems` is the per-card pipeline cap this card adds.
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
  // #4353 — open items from build start until MERGE (durable in-flight ∪ delivered-by-open-PR), a tighter,
  // separate cap from `maxConcurrentBuilds` (which only bounds builds actually running right now). Unmeasured
  // starting point per the operator's own framing — see `planBuildDispatch`'s `wip-cap` rule below.
  maxOpenItems: 7,
  // Live incident 2026-09-28 (we#2852): ONE PR mislabelled `review-status:ci-heal-stalled` (a ci-heal session
  // that had actually finished — see we:scripts/conveyor/review-status-tag.mjs's own fix for that bug) froze
  // EVERY queued build, unrelated scope or not, because these three per-PR labels used to feed the SAME global
  // `frozen` gate as the operator's manual `blocked:daemon-bug`. They are informative/derived
  // (we:scripts/conveyor/review-status-tag.mjs), not an operator decision, and a single stuck PR must never
  // freeze work that does not touch its files — that is exactly what `scope-vs-open-prs` below already proves
  // per candidate against EVERY open PR unconditionally (stalled or not), so a stalled PR still correctly holds
  // an overlapping build without a separate freeze clause. Only `blocked:daemon-bug` — the operator's own manual
  // signal, never auto-applied — still freezes the whole queue; see `globalFreezeLabels` below.
  freezeLabels: Object.freeze([
    'review-status:fix-stalled',
    'review-status:ci-heal-stalled',
    'review-status:review-stalled',
    'blocked:daemon-bug',
  ]),
  // The subset of `freezeLabels` that holds EVERY candidate regardless of scope — see the docblock just above
  // for why the three per-PR `*-stalled` labels were removed from this set (#3383 continuation, live incident
  // 2026-09-28). `freezeLabels` itself is kept, unchanged, purely for status/dry-run display
  // (we:skills-src/conveyor/build-dispatch-daemon.mjs) — `planBuildDispatch` reads `globalFreezeLabels` only.
  globalFreezeLabels: Object.freeze(['blocked:daemon-bug']),
  rules: Object.freeze([
    { id: 'cap', text: 'at most maxConcurrentBuilds builds in flight', enforcedBy: 'build-dispatch-policy.mjs' },
    { id: 'wip-cap', text: 'at most maxOpenItems items open from build start until merge (durable in-flight ∪ delivered-by-open-PR)', enforcedBy: 'build-dispatch-policy.mjs' },
    { id: 'landing-freeze', text: 'no new build while open PRs > maxOpenPrs or any open PR carries a freeze label', enforcedBy: 'build-dispatch-policy.mjs' },
    { id: 'scope-vs-open-prs', text: "a build whose scope overlaps an open PR's files waits for that PR", enforcedBy: 'build-dispatch-policy.mjs' },
    { id: 'hot-file', text: 'no two in-flight builds on the same file', enforcedBy: 'build-dispatch-policy.mjs' },
    { id: 'branch-name', text: 'a delivery branch never starts with a bare number', enforcedBy: 'build-dispatch-policy.mjs (checks the planned ref)' },
    { id: 'scratch-prefix', text: 'scratch files in the brief are task-prefixed', enforcedBy: 'delivery brief (follow-up card)' },
    { id: 'draft-first', text: 'agent PRs open as drafts and are promoted on green', enforcedBy: 'PR #2813' },
    // Card #4470 (operator rule 2026-09-28: PREPARE = full design + explicit MVP cut, build only the MVP) —
    // enforced UPSTREAM of this file: a card with no truthful `preparedDate` never even becomes a candidate
    // this planner sees (`dispatch-plan.mjs` holds it `needs-prepare` before it ever reaches `spawnBuilds`), so
    // this row is DOCUMENTATION PARITY (every operator rule visible here, per this file's own header) — no
    // logic in this planner changes for it.
    { id: 'needs-prepare', text: 'a candidate carrying no truthful preparedDate is never built — held for a prepare pass first', enforcedBy: 'readiness/dispatch-plan.mjs' },
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

/** The delivery-ref shape: `lane/<num>[attempt]-<slug>`. The digit/hash run must end there (so `lane/2385-x`
 *  matches 2385 but not 238), and a leading `x` marks a hash-numbered card (`lane/xcd92xh-x`). */
const DELIVERY_REF_RE = /^lane\/(\d+|x[0-9a-z]{6})[b-z]?-/i;

/** The num an open PR's `headRefName` delivers, or `null` when it does not match the delivery-ref shape at all
 *  (a hand-made / non-item PR, e.g. `lane/investigate-lane-reset` — counts toward `maxOpenPrs` but not toward
 *  `maxOpenItems`, #4353). */
export function prDeliveredNum(pr) {
  const m = DELIVERY_REF_RE.exec(String(pr?.headRefName ?? ''));
  return m ? normNum(m[1]) : null;
}

/** Does an open PR deliver `num`? Same delivery-ref match as {@link prDeliveredNum}, pinned to one num. */
export function prDeliversNum(pr, num) {
  const key = normNum(num);
  if (!key) return false;
  return prDeliveredNum(pr) === key;
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
 * @param {number} [o.externalBuilding]  the conveyor's machine-wide "building" count — hand-dispatched workers,
 *   fix workers, ci-heal workers, stranded claims, AND this daemon's own builds, all folded into one tally with
 *   no way to tell them apart. Operator decision (2026-09-29, card x3vs6tu): this cap bounds ONLY the builder's
 *   own concurrent builds; machine-wide load is the separate load guard's job (#4076) and the heavy-admission
 *   slots', not this cap's. So `externalBuilding` is NEVER folded into `busy` any more — see the live incident
 *   below. It still rides through to the return value (`externalBuilding` field) purely as a logged signal, so
 *   the daemon's dry-run/status line can keep showing it even though it no longer gates anything here.
 *
 *   Live incident, 2026-09-29 ~10:35 AM ET: with 2 stranded claims + 4 hand-dispatched workers, this builder
 *   read "6 building" at its own cap of 6 (0 of its own builds actually making progress) and dispatched NOTHING
 *   for 30+ minutes while 116 items sat queued — the old `max(durable in-flight, externalBuilding)` math let a
 *   machine-wide count that had nothing to do with this builder's own concurrency hold every candidate. At the
 *   operator's chosen cap of 3 the builder would never build at all while ANY other worker ran anywhere.
 * @param {{engaged:boolean, reason?:string}} [o.killSwitch]
 * @param {object} [o.policy]
 * @returns {{freeze:{frozen:boolean, reasons:string[]}, slots:number, dispatch:Array<object>, hold:Array<object>,
 *   openItems:{count:number, cap:number, nums:string[]}}} `openItems` is the PRE-TICK union
 *   (`{inFlight} ∪ {delivered-by-open-PR}`), #4353 — the value the `wip-cap` rule below checks and decrements.
 */
export function planBuildDispatch({
  candidates = [], inFlight = [], openPrs = [], externalBuilding = 0, killSwitch = { engaged: false }, policy = BUILD_DISPATCH_POLICY,
} = {}) {
  const hold = [];
  const dispatch = [];
  const freezeReasons = [];
  if (killSwitch?.engaged) freezeReasons.push(`kill switch engaged${killSwitch.reason ? ` (${killSwitch.reason})` : ''}`);
  if (openPrs.length > policy.maxOpenPrs) freezeReasons.push(`${openPrs.length} open PRs > maxOpenPrs ${policy.maxOpenPrs}`);
  // GLOBAL freeze set — `blocked:daemon-bug` only (#3383 continuation, live incident 2026-09-28). A per-PR
  // `*-stalled` label never reaches this set any more; it is still an ordinary open PR below, so the
  // `scope-vs-open-prs` loop still holds any candidate whose scope overlaps ITS files. Falls back to the full
  // `freezeLabels` only for a caller passing a policy object that predates `globalFreezeLabels` (defensive, not
  // expected in this codebase — every caller here uses `BUILD_DISPATCH_POLICY`).
  const freezeSet = new Set(policy.globalFreezeLabels ?? policy.freezeLabels ?? []);
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
  // Card x3vs6tu (2026-09-29): the cap counts ONLY this builder's own durable in-flight builds — never
  // `externalBuilding` (machine-wide "building", not attributable to this builder). Kept as a logged signal
  // below (`externalBuilding` on the return value), never folded into `busy`/`slots` any more.
  const busy = running.length;
  let slots = Math.max(0, policy.maxConcurrentBuilds - busy);
  const picked = [];
  // #4353 — a policy object missing `maxOpenItems` (a caller predating this field) must never silently disable
  // the cap: `>= undefined` is always false, so an unguarded read would fail OPEN. Falls back to the declared
  // default the same way `globalFreezeLabels ?? freezeLabels` already does above for an older policy shape.
  const maxOpenItems = Number.isFinite(policy.maxOpenItems) ? policy.maxOpenItems : BUILD_DISPATCH_POLICY.maxOpenItems;

  // #4353 — the WIP union: {inFlight} ∪ {delivered-by-open-PR}, deduped by num (a build whose OWN PR is already
  // open and counted is not double-counted just because its claim also still shows in-flight).
  // `openItemsInitial` is the PRE-TICK snapshot the return value / report field reads; `openItems` (below) is the
  // WORKING COPY the loop mutates as each candidate is admitted, exactly like `slots` already does for
  // `maxConcurrentBuilds` — a static one-time gate would wrongly admit multiple candidates in one pass once
  // their combined count crosses `maxOpenItems` (Risks, #4353).
  const openItemsInitial = new Set(inFlightByNum.keys());
  for (const pr of openPrs) {
    const n = prDeliveredNum(pr);
    if (n) openItemsInitial.add(n);
  }
  const openItems = new Set(openItemsInitial);

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
    // #4353 wip-cap — checked BEFORE the plain concurrency `cap` below, inside the SAME per-candidate loop
    // (`openItems` grows as candidates are admitted, never a static pre-tick gate). `num` is guaranteed absent
    // from `openItems` here: EITHER member of the union that could already hold it — already in-flight
    // (`inFlightByNum.has(num)`, above) or already delivered by an open PR (`deliveringPr`, above) — already
    // `continue`d this candidate via the `in-flight` rule before this line is ever reached. So admitting it
    // here always grows the union by exactly one.
    if (openItems.size >= maxOpenItems) {
      hold.push({ ...base, rule: 'wip-cap', reason: `${openItems.size} open items (cap ${maxOpenItems}): ${[...openItems].sort().join(', ')}` });
      continue;
    }
    if (slots <= 0) { hold.push({ ...base, rule: 'cap', reason: `${busy + picked.length} builds in flight (cap ${policy.maxConcurrentBuilds})` }); continue; }
    slots -= 1;
    openItems.add(num);
    const pick = { ...base, scope: c.scope, source: 'this-tick' };
    picked.push(pick);
    dispatch.push(pick);
  }
  return {
    freeze: { frozen, reasons: freezeReasons }, inFlight: running, busy, slots, dispatch, hold,
    // Card x3vs6tu — logged signal only (never gates `busy`/`slots` above): the machine-wide "building" count
    // the tick core passed in, visible to a dry-run/status line even though this cap no longer reads it.
    externalBuilding: Number(externalBuilding) || 0,
    openItems: { count: openItemsInitial.size, cap: maxOpenItems, nums: [...openItemsInitial].sort() },
  };
}

/** The report/status-line shape for `plan.openItems` (#4353) — `nums` renamed to `filling`, the name a reader
 *  outside this module (a dry-run report, a live status line) expects. Pure, exported so the field rename is
 *  pinned by a test independent of the daemon's IO shell. */
export function reportOpenItems(openItems) {
  return { count: openItems.count, cap: openItems.cap, filling: openItems.nums };
}

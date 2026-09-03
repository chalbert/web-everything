/**
 * @file scripts/conveyor/reconcile-fix-dispatch.mjs
 * @description #3438 — DISPATCH THE FIX AGENT `we:scripts/conveyor/reconcile-pass.mjs` DECIDES IS OWED.
 *
 * THE GAP THIS CLOSES. `reconcile-pass.mjs` (#3296) already decides, correctly, that a bounced (`review:changes`)
 * PR with a real finding, an unspent attempt cap, and nothing live working it OWES a fix (`kind: 'fix'`) — but it
 * "DISPATCHES NOTHING ITSELF" (its own docblock), and nothing has ever called that decision for the `fix` kind.
 * `we:scripts/conveyor/tick-core.mjs#planFixSpawns` looks like the same job but is NOT: it only ever considers a
 * PR in `state.prs` whose `num` is in `launchedNums` — i.e. a PR THIS conveyor session's own bookkeeping launched
 * and still remembers. `reconcile-pass.mjs` is keyed by PR number alone and reads live `gh`/`claude agents` state
 * fresh every pass, so it also covers a bounced PR this specific conveyor process never launched (a restart lost
 * the memory of, one a sibling process launched, one opened by hand) — the two are genuinely different
 * populations, not a duplicate mechanism (see the item's own "Scope, narrowed in light of #3332" section for the
 * question this file answers: YES, genuinely different, so (b) applies — wire it).
 *
 * WHY THIS IS ITS OWN FILE, NOT A DETOUR THROUGH `we:scripts/operations/dispatch-lane.mjs`'s OWN `--num=` CLI.
 * That CLI resolves ONE launch by finding `num` inside `planTick`'s five lists (`decisions.spawnFixes` among
 * them) — a `reconcile-pass.mjs` fix entry will NEVER appear there, for the exact reason above, so `--num=`
 * would find nothing to dispatch no matter what `num` is passed. This file does not re-derive `dispatch-lane`'s
 * policy, though — it REUSES its actual fill/dispatch primitives verbatim (`we:scripts/operations/
 * dispatch-lane.mjs#fillBrief` + `#BRIEF_REQUIRED_BY_KIND.fix` + `#sessionSlugFor`, `we:scripts/operations/
 * dispatch-lane-io.mjs#buildAgentArgv` + `#defaultSpawnAgent` + `#findItem`/`#defaultLoadItems`) — the same
 * "the corrected fillBrief token set... however it resolves the scope-refusal question" this item's own text
 * asks for, not a bespoke fill/dispatch path. The shape this file itself follows — plan → fill the brief → mint a
 * session id → spawn, with no lane pre-acquired by the dispatcher (the agent's own brief step 1 acquires its
 * own) — mirrors `we:scripts/operations/review-dispatch.mjs#dispatchReview` (#3279) closely, because that is the
 * existing, already-landed precedent for "dispatch directly against a PR number, outside `planTick`'s own
 * launch lists".
 *
 * THE ONE THING `dispatchReview` DOES NOT NEED THAT THIS FILE DOES: A LANE NUMBER. `{{LANE}}` is baked into
 * `we:skills-src/conveyor/fix-agent-brief.md`'s own acquire line (`--lane={{LANE}}`) — unlike
 * `we:skills-src/review/review-agent-brief.md`'s lane-less `acquire` (no `--lane=` at all, so the pool auto-picks
 * one) — because that brief is SHARED with `dispatch-lane.mjs`'s own tick-core-driven fix dispatch, which DOES
 * pre-assign a specific lane from `decisions.spawnFixes[].lane`. Rather than fork the brief (twin templates for
 * the same job is exactly the drift risk `we:scripts/conveyor/review-session-slug.mjs`'s own header warns about
 * for a slug function), this file reads a currently-free lane NUMBER at dispatch time — the SAME
 * `lane-pool.mjs list --acquirable --json` read `we:scripts/conveyor/tick-core.mjs`'s own IO shell uses to build
 * `freeLanes` for `planFixSpawns` — and fills `{{LANE}}` with it. This is a READ, not a lock: the dispatched
 * agent still does the real `acquire` itself in its own brief step 1, and can lose the race to a sibling exactly
 * as any other dispatch already can (`we:skills-src/conveyor/delivery-agent-brief.md`'s own step 1: "If that lane
 * lost its race to a sibling, `acquire` fails loud — report it and exit").
 *
 * DOUBLE-DISPATCH GUARD: NAME-BASED LIVENESS, NOT A SEPARATE LEDGER. This file keeps no bookkeeping of its own
 * between passes (deliberately — see `reconcile-pass.mjs`'s own "session-ephemeral" argument against folding into
 * the tick). The guard against re-dispatching a fix that is already running is `reconcile-core.mjs#bindAgents`'s
 * OWN liveness read: it now recognizes a live `fix-<pr>` session by name (#3438, mirroring the `review-<pr>`
 * name-bind #3437 already added) and refuses (`live-process`) before `planReconcile` ever returns a `kind:'fix'`
 * dispatch entry for that PR again. This is exactly `review-dispatch.mjs`'s own safety net — it carries no
 * separate in-flight ledger either.
 *
 * A ONE-SHOT PASS, LIKE ITS SIBLINGS. Read `reconcile-pass.mjs`'s plan, dispatch every `kind:'fix'` entry it
 * offers, report, exit. Wired into `we:skills-src/conveyor/runner.mjs`'s mechanical passes (#3438) alongside
 * infra-blocked recovery / the lease-reaper / the session-reaper / the hiccup sink — best-effort, never gating
 * the tick.
 */
import { execFileSync } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  agentArgsFromEnv, assertNotALaneCheckout, buildAgentArgv, defaultLoadItems, defaultSpawnAgent, findItem,
  REPO_ROOT,
} from '../operations/dispatch-lane-io.mjs';
import { assertMainNotStale } from '../operations/review-dispatch.mjs';
import { BRIEF_REQUIRED_BY_KIND, fillBrief, sessionSlugFor } from '../operations/dispatch-lane.mjs';
import { laneRefItemNum } from './lease-reaper.mjs';
import { runReconcilePass } from './reconcile-pass.mjs';

/** The template `we:skills-src/conveyor/fix-agent-brief.md` — the SAME brief `dispatch-lane.mjs`'s own
 *  tick-core-driven fix dispatch fills, read fresh per dispatch so an edit takes effect with no restart. */
export function fixBriefPath(root = REPO_ROOT) {
  return join(root, 'skills-src', 'conveyor', 'fix-agent-brief.md');
}

/**
 * we:scripts/conveyor/reconcile-fix-dispatch.mjs#planFixesFromReconcile — PURE. Narrow `reconcile-pass.mjs`'s
 * `kind:'fix'` dispatch entries down to the ones this file can actually act on, and NAME why each one it drops
 * cannot be (mirroring `reconcile-core.mjs`'s own REFUSAL_KINDS discipline: a refusal a reader cannot audit is
 * exactly the defect this whole chain exists to remove).
 *
 * TWO THINGS CAN MAKE AN OTHERWISE-OWED FIX UNDISPATCHABLE, BOTH NAMED:
 *   `no-item-num` — the PR's head ref carries no conveyor item number (`laneRefItemNum` returns `null` — not
 *     every open PR is a `lane/<NUM>-<slug>` branch; a hand-opened or externally-branched PR is not). Without an
 *     item number there is no `{{ITEM_NUM}}`, no scope lookup, and no honest `WE #<n>:` commit prefix for the
 *     fix-agent-brief to use — undispatchable, not a bug to route around.
 *   `no-scope`     — the item number resolves, but the backlog loader has no scope for it (deleted item, or one
 *     scaffolded with no `scope:` frontmatter). Mirrors `dispatch-lane.mjs`'s OWN scope-refusal
 *     (`itemScope.length` check) for exactly the same reason: a fix agent with no declared scope has no fence.
 * @param {Array<{kind:string, prNumber:number, headRefName?:string|null}>} dispatchEntries -
 *   `reconcile-pass.mjs`'s own `dispatch` array (see `we:scripts/conveyor/reconcile-core.mjs#planReconcile`).
 * @param {(key:string, loadItems:Function)=>({num:string,slug:string,specPath:string,scope:string[]}|null)} findItemFn
 * @param {Function} loadItems
 * @returns {{planned:Array<{itemNum:string,pr:number,laneRef:string,scope:string[]}>, refusals:Array<{pr:number,kind:string,why:string}>}}
 */
export function planFixesFromReconcile(dispatchEntries, findItemFn, loadItems) {
  const planned = [];
  const refusals = [];
  for (const entry of Array.isArray(dispatchEntries) ? dispatchEntries : []) {
    if (!entry || entry.kind !== 'fix') continue;
    const pr = Number(entry.prNumber);
    const headRefName = entry.headRefName ?? null;
    const itemNum = laneRefItemNum(headRefName);
    if (!itemNum) {
      refusals.push({ pr, kind: 'no-item-num', why: `PR #${pr}'s head ref (${headRefName ?? '?'}) carries no conveyor item number — nothing to fill {{ITEM_NUM}}/{{SCOPE}} with` });
      continue;
    }
    const item = findItemFn(itemNum, loadItems);
    if (!item || !item.scope.length) {
      refusals.push({ pr, kind: 'no-scope', why: `item #${itemNum} (PR #${pr}) has no declared scope — refusing to dispatch a fix agent with no fence` });
      continue;
    }
    planned.push({ itemNum, pr, laneRef: headRefName, scope: item.scope });
  }
  return { planned, refusals };
}

/** we:scripts/conveyor/reconcile-fix-dispatch.mjs#freeLaneNumbers — the SAME `lane-pool.mjs list --acquirable
 *  --json` read `we:scripts/conveyor/tick-core.mjs`'s own IO shell uses to build `freeLanes`, reused rather than
 *  re-derived. A READ, not a lock — see the file header for why that is the correct trade here.
 * @param {{exec?:Function, root?:string}} [o]
 * @returns {number[]} ascending lane ids currently acquirable, or `[]` on any read failure (fail-soft — the
 *   caller reports `no-lane` for every planned fix rather than throwing the whole pass over a `gh`/pool hiccup).
 */
export function freeLaneNumbers({ exec = execFileSync, root = REPO_ROOT } = {}) {
  try {
    const out = exec('node', [join(root, 'scripts', 'lane-pool.mjs'), 'list', '--acquirable', '--json'], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 8 * 1024 * 1024,
    });
    const paths = JSON.parse(String(out || '[]'));
    return (Array.isArray(paths) ? paths : [])
      .map((p) => { const m = /lane-(\d+)\/?$/.exec(String(p)); return m ? Number(m[1]) : null; })
      .filter((n) => n != null)
      .sort((a, b) => a - b);
  } catch {
    return [];
  }
}

/**
 * we:scripts/conveyor/reconcile-fix-dispatch.mjs#dispatchFix — DISPATCH ONE FIX AGENT for one planned entry.
 * Mirrors `we:scripts/operations/review-dispatch.mjs#dispatchReview`'s own composition (plan → fill → mint a
 * fresh session id → spawn), reusing `dispatch-lane.mjs`'s real fill/dispatch primitives rather than this file's
 * own copies.
 * @param {{itemNum:string, pr:number, laneRef:string, scope:string[], lane:number}} planned
 * @param {object} [o]
 * @returns {{sessionId:string, sessionSlug:string, pr:number, itemNum:string, lane:number, unknownTokens:string[]}}
 */
export function dispatchFix(planned, {
  root = REPO_ROOT,
  readBrief = (r) => readFileSync(fixBriefPath(r), 'utf8'),
  mintSessionId = () => randomUUID(),
  spawnAgent = defaultSpawnAgent,
  extraArgs = [],
} = {}) {
  assertNotALaneCheckout(root);
  const sessionSlug = sessionSlugFor(planned.itemNum, 'fix', planned.pr);
  const { prompt, unknownTokens } = fillBrief(readBrief(root), {
    ITEM_NUM: planned.itemNum,
    PR_NUM: planned.pr,
    LANE_REF: planned.laneRef,
    LANE: planned.lane,
    SESSION_SLUG: sessionSlug,
    SCOPE: planned.scope.join(','),
  }, BRIEF_REQUIRED_BY_KIND.fix);
  const sessionId = String(mintSessionId());
  const argv = buildAgentArgv({ sessionId, payload: { prompt, sessionSlug }, extraArgs });
  spawnAgent(argv, { cwd: root });
  return { sessionId, sessionSlug, pr: planned.pr, itemNum: planned.itemNum, lane: planned.lane, unknownTokens };
}

/**
 * we:scripts/conveyor/reconcile-fix-dispatch.mjs#runReconcileFixDispatch — the WHOLE pass: read
 * `reconcile-pass.mjs`'s plan (reused, not re-run by hand), narrow it to dispatchable fixes
 * ({@link planFixesFromReconcile}), assign each a currently-free lane, and dispatch. Read-then-act, exactly like
 * its siblings; a failure dispatching ONE entry is reported and does not stop the rest.
 * @param {object} [o]
 * @param {Function} [o.reconcile] - injectable, defaults to the real {@link runReconcilePass}.
 * @returns {{dispatched:Array<object>, refusals:Array<object>, reconcileRefusals:number}}
 */
export function runReconcileFixDispatch({
  root = REPO_ROOT,
  repo = null,
  findItemFn = findItem,
  loadItems = () => defaultLoadItems(root),
  pickFreeLanes = () => freeLaneNumbers({ root }),
  dispatch = dispatchFix,
  reconcile = runReconcilePass,
  checkStaleness,
} = {}) {
  assertMainNotStale(root, checkStaleness);
  const reconciled = reconcile({ repo });
  const { planned, refusals } = planFixesFromReconcile(reconciled.dispatch, findItemFn, loadItems);

  const lanes = [...pickFreeLanes()];
  const dispatched = [];
  for (const entry of planned) {
    if (lanes.length === 0) {
      refusals.push({ pr: entry.pr, kind: 'no-lane', why: `no free lane to dispatch a fix agent for PR #${entry.pr}` });
      continue;
    }
    const lane = lanes.shift();
    try {
      dispatched.push(dispatch({ ...entry, lane }, { root, extraArgs: agentArgsFromEnv() }));
    } catch (e) {
      refusals.push({ pr: entry.pr, kind: 'dispatch-failed', why: String((e && e.message) || e).split('\n')[0] });
    }
  }

  return { dispatched, refusals, reconcileRefusals: reconciled.refusals.length };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const flags = {};
  for (const a of process.argv.slice(2)) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  let result;
  try {
    result = runReconcileFixDispatch({ repo: typeof flags.repo === 'string' ? flags.repo : null });
  } catch (e) {
    process.stderr.write(`✗ reconcile-fix-dispatch failed: ${String((e && e.message) || e).split('\n')[0]}\n`);
    process.exit(1);
  }
  if (flags.json) {
    process.stdout.write(JSON.stringify(result) + '\n');
  } else {
    const lines = [`reconcile-fix-dispatch — ${result.dispatched.length} dispatched, ${result.refusals.length} refusal(s)`];
    for (const d of result.dispatched) lines.push(`  → fix    PR #${d.pr} (item #${d.itemNum}) — session ${d.sessionId} (${d.sessionSlug}), lane-${d.lane}`);
    for (const r of result.refusals) lines.push(`  ✗ ${r.kind} PR #${r.pr} — ${r.why}`);
    process.stdout.write(lines.join('\n') + '\n');
  }
}

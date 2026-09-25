/**
 * @file ci-heal-pr-dispatch.mjs
 * Dispatch ONE ci-heal for a PR that carries `ci:failed`, from `reconcile-core.mjs`'s own durable `kind:'ci-heal'`
 * plan (multi-repo slice 7, `we:backlog/3967-*.md`) — the SAME plan `we:scripts/conveyor/reconcile-fix-dispatch.mjs`
 * reads for `fix`, never a second reconciliation. This is NOT a second ci-heal path: it fills the same
 * `fix-agent-ci-brief.md` (`BRIEF_REQUIRED_BY_KIND['ci-heal']`, the same tokens `dispatch-lane.mjs` fills) and hands
 * one effect payload to the SAME sink the tick uses (`dispatch-lane-io.mjs#createDispatchSinks`), so the provider
 * registry decides what runs: the detached `ci-heal-run.mjs` wrapper by default, or the `claude --bg` brief when
 * `WE_CI_HEAL_DISPATCH_MODE=agent`. The action record guard (`guardedDispatch`) keys on the PR, so a second call for
 * the same PR is `held`, never a double dispatch.
 *
 * WHAT IT ADDED OVER THE TICK PATH, BEFORE THIS SLICE HAD A CALLER: the tick plans ci-heal solely for PRs its own
 * bookkeeping launched (`tick-core.mjs#planCiHealSpawns`, `launchedNums`, session-ephemeral), so a red PR opened by
 * hand, by a sibling process, or orphaned by a restart never reached it — and this file, though it already existed
 * (#2666), had NO CALLER AT ALL: nothing in the tree ever invoked {@link dispatchCiHeal}. {@link
 * runReconcileCiHealDispatch} is that caller — the durable, repo-agnostic sibling of `reconcile-fix-dispatch.mjs
 * #runReconcileFixDispatch`, reading the SAME `reconcile-core.mjs` plan this file's own docblock already named as
 * its source of truth. The retry cap is enforced THERE (`reconcile-core.mjs#planReconcile`'s own `ciHealCap`), on
 * the same durable floor as the tick's (`ci-heal-mark.mjs#countCiHealComments`) — never re-derived here. It never
 * touches a `review:*` label; the wrapper's only PR write is a comment.
 *
 * REPO-TAGGED SESSIONS (multi-repo slice 7 — the second half of this file's own defect: {@link dispatchCiHeal}
 * minted every session as `ci-heal-<pr>`, with no `repo` ever threaded into {@link sessionSlugFor}, so a
 * frontierui/plateau-app heal session was named IDENTICALLY to a WE one — `reconcile-core.mjs#bindAgents`'s own
 * `ci-heal-<pr>` name-bind (which DOES thread `repo` through, since it mints the repo-tagged slug it expects to
 * match) could never recognize a real non-WE heal session as live, so a genuinely in-flight sibling-repo heal
 * would have been re-planned every tick. Threading `repo` through here is what makes the two sides agree.
 */
import { readFileSync } from 'node:fs';
import {
  BRIEF_REQUIRED_BY_KIND, OPTIONAL_BRIEF_PLACEHOLDERS, REPO_AWARE_VALUE_PATTERNS, fillBrief, sessionSlugFor, DISPATCH_EFFECT,
} from './dispatch-lane.mjs';
import {
  agentArgsFromEnv, briefPath, createDispatchSinks, defaultLoadItems, findItem, REPO_ROOT,
} from './dispatch-lane-io.mjs';
import { assertMainNotStale } from './review-dispatch.mjs';
import { repoKeyForSlug } from '../lib/constellation-repos.mjs';
import { repoProfile, briefTokensForRepo } from '../lib/repo-profile.mjs';
import { resolvePrWorkUnit } from '../conveyor/pr-work-unit.mjs';
import { freeLaneNumbers, fetchPrDiffPaths } from '../conveyor/reconcile-fix-dispatch.mjs';
import { runReconcilePass } from '../conveyor/reconcile-pass.mjs';
import { readUnsupported, recordUnsupported } from '../conveyor/unsupported-repo.mjs';
import { readPrsFromFile } from '../conveyor/open-pr-fetch.mjs';

/**
 * @param {{itemNum:(string|null), pr:number, laneRef:string, scope:string[], lane:number, reason?:string, repo?:string}} planned - a `planFixesFromReconcile`
 *   entry (the same planner every repair row uses) plus a lane number and the ci-heal reason (`red-ci` unless told otherwise).
 * @param {object} [o]
 * @returns {Promise<{agentId:(string|null), sessionSlug:string, pr:number, itemNum:(string|null), lane:number, unknownTokens:string[]} | {held:true, reason:string}>}
 */
export async function dispatchCiHeal(planned, {
  root = REPO_ROOT, actions, repo = planned.repo ?? 'we', extraArgs = [],
  readBrief = (r) => readFileSync(briefPath(r, 'ci-heal'), 'utf8'),
  sinks = createDispatchSinks({ root, actions, repo, extraArgs }),
  // #3967 multi-repo slice 7 — mirrors `reconcile-fix-dispatch.mjs#dispatchFix`'s own seam exactly: threaded
  // straight through to `briefTokensForRepo`/`repoProfile`/`gateFor` (all three already accept them), never
  // re-derived here. A sibling repo's checkout is NOT guaranteed present on whatever host runs this — a CI
  // runner carries no `$HOME/workspace/{frontierui,plateau-app}` clone at all — so a real dispatch for one, and
  // every test of one, needs these seams open exactly as `dispatchFix`'s already are.
  home,
  checkoutExists,
  readPackageJson,
} = {}) {
  // #3967 multi-repo slice 7 — `repo` THREADED THROUGH, matching `reconcile-core.mjs#bindAgents`'s own
  // repo-tagged `ci-heal-<pr>` slug (see this file's own docblock for the double-dispatch this fixes).
  const sessionSlug = sessionSlugFor(planned.itemNum, 'ci-heal', planned.pr, '', repo);
  const reason = planned.reason ?? 'red-ci';
  // #3960 — the repo-aware quintet, computed once from `repo`'s own profile (never re-derived here).
  const tokens = briefTokensForRepo(repo, { itemNum: planned.itemNum, prNum: planned.pr, home, checkoutExists, readPackageJson });
  if (!tokens) throw new Error(`dispatch-lane: no repo profile/gate resolved for "${repo}" — refusing to fill the ci-heal brief`);
  const { prompt, unknownTokens } = fillBrief(readBrief(root), {
    ITEM_NUM: planned.itemNum ?? '', PR_NUM: planned.pr, LANE_REF: planned.laneRef, LANE: planned.lane,
    SESSION_SLUG: sessionSlug, SCOPE: planned.scope.join(','), REASON: reason, ...tokens,
  }, BRIEF_REQUIRED_BY_KIND['ci-heal'], [...OPTIONAL_BRIEF_PLACEHOLDERS, 'ITEM_NUM'], REPO_AWARE_VALUE_PATTERNS);
  const out = await sinks[DISPATCH_EFFECT]({
    launchKind: 'ci-heal', prompt, sessionSlug, num: planned.itemNum ?? undefined, lane: planned.lane, scope: planned.scope,
    pr: planned.pr, reason, repo,
  });
  if (out?.held) return out;
  return { agentId: out?.handle ?? null, sessionSlug, pr: planned.pr, itemNum: planned.itemNum ?? null, lane: planned.lane, unknownTokens };
}

/**
 * we:scripts/operations/ci-heal-pr-dispatch.mjs#runReconcileCiHealDispatch — THE WHOLE PASS (multi-repo slice
 * 7, `we:backlog/3967-*.md`): read `reconcile-core.mjs`'s plan (via `reconcile-pass.mjs#runReconcilePass`,
 * reused, not re-run by hand), narrow it to the `kind:'ci-heal'` entries, and dispatch each — mirroring
 * `reconcile-fix-dispatch.mjs#runReconcileFixDispatch`'s own composition (plan → capability-gate → lane →
 * dispatch) for the SAME reason that file gives for `fix`: this pass is one-shot, keeps no bookkeeping of its
 * own between ticks, and reads the plan's own `bindAgents` liveness guard (a live `ci-heal-<pr>` session name)
 * to never double-dispatch.
 *
 * THE REPO GATE LIVES HERE, ON CAPABILITY, NOT IDENTITY (`docs/agent/platform-decisions.md
 * #conveyor-multi-repo-model` clause 5). `planReconcile` itself never checks `capabilities.ciHeal` — the SAME
 * design `reconcile-fix-dispatch.mjs`'s own docblock gives for `fix`: the plan decides what a PR's OWN state
 * owes, capability decides who is allowed to act on it, and those are two different questions asked by two
 * different files. A repo whose profile has `ciHeal` off has every planned `ci-heal` entry recorded
 * `unsupported-repo` (durably, via `unsupported-repo.mjs`, preserving that repo's OTHER action rows —
 * `fix`/`review` — exactly as `runReconcileFixDispatch` already does for its own `fix`/`ci-heal` split),
 * never touching the lane pool or a dispatch sink.
 *
 * ITEM/SCOPE ATTRIBUTION REUSES `pr-work-unit.mjs#resolvePrWorkUnit` — the SAME repo-aware item-or-PR
 * resolver `reconcile-fix-dispatch.mjs#planFixesFromReconcile` builds its own item/scope from (Fork 3 of the
 * ratified multi-repo decision) — never a second derivation. A CI-heal entry carries neither on `reconcile-
 * core.mjs`'s own `dispatch` row (only `prNumber`/`headRefName` — see that file's own `base` object), so this
 * pass resolves them fresh per entry, exactly as `planFixesFromReconcile` does for `fix`.
 * @param {object} [o]
 * @param {string|null} [o.repo] - a constellation repo key, gh slug, or `null` for `we`.
 * @param {Function} [o.dispatch] - injectable, defaults to the real {@link dispatchCiHeal}.
 * @param {Function} [o.reconcile] - injectable, defaults to the real {@link runReconcilePass}.
 * @param {Function} [o.pickFreeLanes] - injectable; when omitted, defaults to {@link freeLaneNumbers} scoped to
 *   THIS repo's own lane pool (`profile.lanePoolRepo`) — never the WE pool for a non-WE repo.
 * @param {Function} [o.resolveProfile] - injectable, defaults to the real {@link repoProfile}.
 * @param {Function} [o.resolveWorkUnit] - injectable, defaults to the real {@link resolvePrWorkUnit}.
 * @returns {Promise<{dispatched:Array<object>, refusals:Array<object>, reconcileRefusals:number,
 *   reconcileRefusalDetails:Array<object>}>} `reconcileRefusals` stays the bare count it always was (an
 *   existing, asserted contract — see `we:scripts/conveyor/__tests__/reconcile-fix-dispatch.test.mjs`'s
 *   sibling assertion on `runReconcileFixDispatch`). `reconcileRefusalDetails` is ADDITIVE (#x0mn6x0, epic
 *   #4075/#3383): the SAME `reconciled.refusals` array the count was always derived from
 *   (`we:scripts/conveyor/reconcile-core.mjs#planReconcile` already computes a `{prNumber, kind, why, ...}`
 *   per entry — see that file's own `refuse()` closure), now handed up instead of collapsed to nothing. A PR
 *   `reconcile-core.mjs` refuses OUTRIGHT (never becoming a `kind:'ci-heal'` dispatch entry at all — e.g.
 *   `owed-ci-rerun`, `no-findings`, `live-process`, `cap-exhausted`, `stood-down`, `owed-elsewhere`,
 *   `nothing-owed`) left NO trace anywhere in the daemon's own tick log before this: it was neither a
 *   `dispatched` entry nor a `refusals` entry (that array only ever held THIS file's OWN per-entry refusals —
 *   `no-lane`/`held`/`dispatch-failed`/`unsupported-repo` — for PRs reconcile DID plan), so a PR silently
 *   never even reaching the plan was invisible. Live incident 2026-09-25: PRs #2635/#2636/#2653 sat
 *   `ci:failed` with the daemon logging only "dispatched 0, refused N" — #2635's real reason
 *   (`owed-ci-rerun`) lived exclusively in here and nowhere the daemon ever printed.
 */
export async function runReconcileCiHealDispatch({
  root = REPO_ROOT,
  repo = null,
  dispatch = dispatchCiHeal,
  reconcile = runReconcilePass,
  pickFreeLanes = null,
  resolveProfile = repoProfile,
  resolveWorkUnit = resolvePrWorkUnit,
  loadItems = () => defaultLoadItems(root),
  fetchDiffPaths = null,
  checkStaleness,
  prsFile, unsupportedPath,
} = {}) {
  const repoKey = repo == null ? 'we' : repoKeyForSlug(repo);
  if (repoKey === null) throw new Error(`ci-heal-pr-dispatch: --repo ${repo} is not a constellation repo`);
  // #x1rr9rh (multi-repo slice 2) — guards the DISPATCHING checkout (this WE checkout's own import path), not
  // the target repo; see `runReconcileFixDispatch`'s identical note for why this runs for every repo.
  assertMainNotStale(root, checkStaleness);
  const reconciled = reconcile({ repo, ...(prsFile ? { readPrs: () => readPrsFromFile(prsFile) } : {}) });
  const ciHealEntries = (reconciled.dispatch ?? []).filter((entry) => entry.kind === 'ci-heal');
  const profile = resolveProfile(repoKey);

  // Preserve any already-recorded `fix`/`review` unsupported rows for this repo — a DIFFERENT stage this file
  // knows nothing about — and replace only its own `ci-heal` rows with what THIS pass just computed.
  const otherRows = readUnsupported({ path: unsupportedPath }).filter((row) => row.repo === repoKey && row.action !== 'ci-heal');

  if (!profile?.capabilities?.ciHeal) {
    const refusals = ciHealEntries.map((entry) => ({
      kind: 'unsupported-repo', repo: repoKey, prNumber: entry.prNumber, action: 'ci-heal',
      why: 'CI-heal dispatch requires a repo-specific brief and gate; the existing worker is WE-only.',
    }));
    recordUnsupported({ repo: repoKey, rows: [...otherRows, ...refusals], path: unsupportedPath });
    return { dispatched: [], refusals, reconcileRefusals: reconciled.refusals.length, reconcileRefusalDetails: reconciled.refusals };
  }
  // `ci-heal` IS supported here — clear any stale `ci-heal` unsupported rows, preserving `fix`/`review` rows.
  recordUnsupported({ repo: repoKey, rows: otherRows, path: unsupportedPath });

  const resolveDiffPaths = fetchDiffPaths ?? ((pr) => fetchPrDiffPaths(pr, { root, repo: repoKey }));
  const lanes = [...(typeof pickFreeLanes === 'function' ? pickFreeLanes() : freeLaneNumbers({ root, lanePoolRepo: profile.lanePoolRepo }))];
  const dispatched = [];
  const refusals = [];
  for (const entry of ciHealEntries) {
    let unit = null;
    try {
      unit = resolveWorkUnit({
        repo: repoKey,
        pr: { number: entry.prNumber, headRefName: entry.headRefName },
        findItem: (n) => findItem(n, loadItems),
        fetchDiffPaths: resolveDiffPaths,
      });
    } catch { unit = null; }
    const planned = {
      itemNum: unit?.itemNum ?? null, pr: entry.prNumber, laneRef: entry.headRefName,
      scope: Array.isArray(unit?.scope) ? unit.scope : [], reason: 'red-ci',
    };

    if (lanes.length === 0) {
      refusals.push({ pr: entry.prNumber, kind: 'no-lane', why: `no free lane to dispatch a CI-heal agent for PR #${entry.prNumber}` });
      continue;
    }
    planned.lane = lanes.shift();
    try {
      // eslint-disable-next-line no-await-in-loop -- sequential by design: this repo's own lane pool is popped
      // one at a time, so two entries in the same pass can never race for the same lane number.
      const result = await dispatch(planned, { root, repo: repoKey, extraArgs: agentArgsFromEnv() });
      if (result?.held) { refusals.push({ pr: entry.prNumber, kind: 'held', why: result.reason ?? `a CI-heal for PR #${entry.prNumber} is already in flight` }); continue; }
      dispatched.push(result);
    } catch (e) {
      refusals.push({ pr: entry.prNumber, kind: 'dispatch-failed', why: String((e && e.message) || e).split('\n')[0] });
    }
  }

  return { dispatched, refusals, reconcileRefusals: reconciled.refusals.length, reconcileRefusalDetails: reconciled.refusals };
}

const IS_CLI = process.argv[1] && new URL(import.meta.url).pathname === process.argv[1];
if (IS_CLI) {
  const flags = {};
  for (const a of process.argv.slice(2)) {
    if (!a.startsWith('--')) continue;
    const eq = a.indexOf('=');
    if (eq === -1) flags[a.slice(2)] = true;
    else flags[a.slice(2, eq)] = a.slice(eq + 1);
  }
  runReconcileCiHealDispatch({ repo: typeof flags.repo === 'string' ? flags.repo : null, prsFile: flags['prs-file'] })
    .then((result) => {
      if (flags.json) {
        process.stdout.write(JSON.stringify(result) + '\n');
        return;
      }
      const lines = [`ci-heal-pr-dispatch — ${result.dispatched.length} dispatched, ${result.refusals.length} refusal(s)`];
      for (const d of result.dispatched) {
        const who = d.agentId ? `agent ${d.agentId}` : 'agent (id unread)';
        const itemLabel = d.itemNum ? `item #${d.itemNum}` : 'no backlog item';
        lines.push(`  → ci-heal PR #${d.pr} (${itemLabel}) — ${who} (${d.sessionSlug}), lane-${d.lane}`);
      }
      for (const r of result.refusals) lines.push(`  ✗ ${r.kind} PR #${r.prNumber ?? r.pr} — ${r.why}`);
      process.stdout.write(lines.join('\n') + '\n');
    })
    .catch((e) => {
      process.stderr.write(`✗ ci-heal-pr-dispatch failed: ${String((e && e.message) || e).split('\n')[0]}\n`);
      // `process.exitCode` (remedy (a), we:scripts/lib/write-all-sync.mjs), never `process.exit(…)`: this is the
      // LAST thing this catch runs, and `process.stdout.write` above (the success path) sits close enough in
      // this promise chain that `stdout-flush-scan.mjs`'s proximity scan reads it as followed by an exit —
      // `exitCode` + a natural return lets Node drain stdout on its own, so nothing needs a synchronous drain.
      process.exitCode = 1;
    });
}

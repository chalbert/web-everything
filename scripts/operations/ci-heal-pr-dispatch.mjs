/**
 * @file ci-heal-pr-dispatch.mjs
 * Dispatch ONE ci-heal for a PR that carries `ci:failed`, from land-advance's `dispatch-ci-heal` owed row.
 * This is NOT a second ci-heal path: it fills the same `fix-agent-ci-brief.md` (`BRIEF_REQUIRED_BY_KIND['ci-heal']`, the
 * same tokens `dispatch-lane.mjs` fills) and hands one effect payload to the SAME sink the tick uses
 * (`dispatch-lane-io.mjs#createDispatchSinks`), so the provider registry decides what runs: the detached
 * `ci-heal-run.mjs` wrapper by default, or the `claude --bg` brief when `WE_CI_HEAL_DISPATCH_MODE=agent`. The action
 * record guard (`guardedDispatch`) keys on the PR, so a second call for the same PR is `held`, never a double dispatch.
 * What it adds over the tick path is only the entry: the tick plans ci-heal solely for PRs its own bookkeeping launched
 * (`tick-core.mjs#planCiHealSpawns`, `launchedNums`), so a red PR opened by hand or by an earlier process never reaches it.
 * The retry cap is enforced by the planner (`land-advance-repair.mjs`), on the same durable floor as the tick's
 * (`ci-heal-mark.mjs#countCiHealComments`). It never touches a `review:*` label; the wrapper's only PR write is a comment.
 */
import { readFileSync } from 'node:fs';
import {
  BRIEF_REQUIRED_BY_KIND, OPTIONAL_BRIEF_PLACEHOLDERS, REPO_AWARE_VALUE_PATTERNS, fillBrief, sessionSlugFor, DISPATCH_EFFECT,
} from './dispatch-lane.mjs';
import { briefPath, createDispatchSinks, REPO_ROOT } from './dispatch-lane-io.mjs';
import { briefTokensForRepo } from '../lib/repo-profile.mjs';

/**
 * @param {{itemNum:(string|null), pr:number, laneRef:string, scope:string[], lane:number, reason?:string}} planned - a `planFixesFromReconcile`
 *   entry (the same planner every repair row uses) plus a lane number and the ci-heal reason (`red-ci` unless told otherwise).
 * @param {object} [o]
 * @returns {Promise<{agentId:(string|null), sessionSlug:string, pr:number, itemNum:(string|null), lane:number, unknownTokens:string[]} | {held:true, reason:string}>}
 */
export async function dispatchCiHeal(planned, {
  root = REPO_ROOT, actions, repo = planned.repo ?? 'we', extraArgs = [],
  readBrief = (r) => readFileSync(briefPath(r, 'ci-heal'), 'utf8'),
  sinks = createDispatchSinks({ root, actions, repo, extraArgs }),
} = {}) {
  const sessionSlug = sessionSlugFor(planned.itemNum, 'ci-heal', planned.pr);
  const reason = planned.reason ?? 'red-ci';
  // #3960 — the repo-aware quintet, computed once from `repo`'s own profile (never re-derived here).
  const tokens = briefTokensForRepo(repo, { itemNum: planned.itemNum, prNum: planned.pr });
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

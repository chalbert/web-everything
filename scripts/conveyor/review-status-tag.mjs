#!/usr/bin/env node
/**
 * @file scripts/conveyor/review-status-tag.mjs
 * @description Tag a PR with an INFORMATIVE `review-status:<state>` label — "is a reviewer or a fixer
 *   currently working this PR right now, and is it actually making progress or stuck" — derived from live
 *   `claude agents --json` truth, never a second source of truth. Purely cosmetic, same contract as its
 *   sibling `we:scripts/conveyor/review-round-tag.mjs`: nothing reads this label back to decide anything, so a
 *   missed or failed tag write never breaks the mechanism — only the human-visible hint goes briefly stale.
 *
 * WHY THIS EXISTS (the operator, 2026-09-01): "expose if a reviewing is currently reviewing and if a fixer is
 * currently fixing... an understand if the agent crash it might hang, but better visibility on what is
 * actioned upon." A `blocked` (stuck, possibly hung) session is exactly the class of hazard this epic already
 * found live tonight (a 211-hour-held permission block, named in `we:scripts/conveyor/reconcile-core.mjs`'s own
 * docblock) — so `stalled` is a first-class state here, not an afterthought.
 *
 * "PERIODICALLY... REAL STATE AND TAG STAY ALIGNED" (the operator's own follow-up: no new internal design
 * needed) — this rides the SAME `we:skills-src/conveyor/runner.mjs` tick that already dispatches reviews/fixes
 * every ~120s, exactly like `review-round-tag.mjs` does. Every tick re-derives from a fresh `claude agents
 * --json` read and re-applies the label idempotently — self-correcting by construction, no separate poller.
 *
 * DELIBERATELY INDEPENDENT of `we:scripts/conveyor/reconcile-core.mjs`'s own liveness binding (`assessLiveness`)
 * — that exact code path is under live suspicion tonight (#xh0vtzh, the confirmed review-dispatch double-spawn
 * bug), so this reads `claude agents --json` fresh and matches by session NAME only (`review-<pr>` /
 * `fix-<pr>`, the same slugs `we:scripts/operations/review-dispatch.mjs#reviewSessionSlug` and
 * `we:scripts/operations/dispatch-lane.mjs`'s own `fix-${id}` mint), rather than sharing that binding.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { defaultListAgents } from '../operations/dispatch-lane-io.mjs';
import { createGhProvider } from '../lib/review-label-provider.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

/** Matches this module's own label shape, and only this shape. */
export const STATUS_LABEL_RE = /^review-status:(reviewing|review-stalled|fixing|fix-stalled)$/;

/**
 * `claude agents --json` states this module treats as LIVE — something is currently actioned, or stuck trying
 * to be. `working` is real progress; `blocked` is the confirmed hang shape this module exists to surface (the
 * 211-hour permission-block this epic found live, `we:scripts/conveyor/reconcile-core.mjs`'s own docblock).
 * Every OTHER state — `done` above all — is NOT live: `claude agents --json` never prunes a finished session,
 * so a `done` row for `review-<pr>`/`fix-<pr>` can sit there indefinitely, long after the PR merged. Reading
 * `done` as "stalled" would tag every PR that ever had a review dispatched as permanently stuck — worse than
 * no signal at all. `done` (and anything unrecognized) means: nothing is being actioned on this PR right now.
 */
const LIVE_STATES = Object.freeze({ working: 'reviewing', blocked: 'stalled' });

/**
 * PURE: find the LIVE agent session (if any) bound to `pr` by NAME alone (`review-<pr>` / `fix-<pr>`) and
 * classify it. See {@link LIVE_STATES} for exactly which raw states count as live.
 * @param {{pr:number|string, agents?:Array<{name?:string, state?:string}>}} o
 * @returns {{role:'review'|'fix', state:'reviewing'|'review-stalled'|'fixing'|'fix-stalled'}|null}
 */
export function deriveReviewStatus({ pr, agents = [] } = {}) {
  const reviewName = `review-${pr}`;
  const fixName = `fix-${pr}`;
  const list = Array.isArray(agents) ? agents : [];
  // Prefer a `working` match over a `blocked` one for the SAME name (several historical rows can share a
  // name) — a session actually making progress right now is more informative than a stuck sibling. A `done`/
  // other row is simply not a candidate at all — see LIVE_STATES.
  const liveFor = (name) => {
    const matches = list.filter((a) => a?.name === name && Object.hasOwn(LIVE_STATES, a.state));
    return matches.find((a) => a.state === 'working') ?? matches[0] ?? null;
  };
  const review = liveFor(reviewName);
  if (review) return { role: 'review', state: review.state === 'working' ? 'reviewing' : 'review-stalled' };
  const fix = liveFor(fixName);
  if (fix) return { role: 'fix', state: fix.state === 'working' ? 'fixing' : 'fix-stalled' };
  return null;
}

/**
 * PURE: what to add/remove so `currentLabels` shows EXACTLY the derived status label, or NO `review-status:*`
 * label at all when nothing is live (never a fabricated "idle" label spammed onto every quiet PR).
 * @param {{status:{state:string}|null, currentLabels?:Array<{name?:string}|string>}} o
 * @returns {{add:string|null, remove:string[]}}
 */
export function planStatusLabelChange({ status, currentLabels = [] } = {}) {
  const names = currentLabels.map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean);
  const desired = status ? `review-status:${status.state}` : null;
  const stale = names.filter((n) => STATUS_LABEL_RE.test(n) && n !== desired);
  const alreadyCorrect = (desired ? names.includes(desired) : true) && stale.length === 0;
  return { add: alreadyCorrect ? null : desired, remove: stale };
}

/**
 * THE IO SHELL. Reads live agents + the PR's current labels, derives the status, applies the change only if
 * one is needed. Both reads are injectable so a test asserts behavior with no `claude`/`gh` process.
 * @param {{pr:number|string, repo:string, listAgents?:Function, provider?:object}} o
 * @returns {{changed:boolean, label:string|null, removed:string[]}}
 */
export function tagReviewStatus({ pr, repo, listAgents = defaultListAgents, provider = createGhProvider() } = {}) {
  const agents = listAgents();
  const status = deriveReviewStatus({ pr, agents });
  const currentLabels = provider.readLabels(repo, pr);
  const plan = planStatusLabelChange({ status, currentLabels });
  if (!plan.add && plan.remove.length === 0) {
    return { changed: false, label: status ? `review-status:${status.state}` : null, removed: [] };
  }
  // `review-status:*` is a small fixed enum, but a repo that has never carried one yet still needs it created
  // before `gh pr edit --add-label` will accept it — same reasoning as `review-round-tag.mjs`'s own ensure.
  if (plan.add) provider.ensureLabel(repo, plan.add, { color: 'c5def5', description: 'informative: a reviewer/fixer is currently working this PR, or stuck (auto-managed)' });
  // `add` is optional on the shared port (#2026-09-01 extension) precisely for this remove-only case: nothing
  // is live, so there is no replacement label — only the stale one comes off.
  provider.setLabels(repo, pr, { add: plan.add ?? undefined, remove: plan.remove });
  return { changed: true, label: plan.add, removed: plan.remove };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flag = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3) || undefined;
  const pr = argv.find((a) => /^\d+$/.test(a));
  const repo = flag('repo');
  if (!pr || !repo) {
    writeLineSync(2, 'usage: review-status-tag.mjs <pr> --repo=<owner/name>');
    process.exitCode = 2;
  } else {
    try {
      const result = tagReviewStatus({ pr, repo });
      writeAllSync(1, `${JSON.stringify(result)}\n`);
    } catch (e) {
      writeLineSync(2, `error: ${String(e?.message ?? e)}`);
      process.exitCode = 1;
    }
  }
}

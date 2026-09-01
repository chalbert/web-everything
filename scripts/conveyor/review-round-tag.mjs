#!/usr/bin/env node
/**
 * @file scripts/conveyor/review-round-tag.mjs
 * @description Tag a PR with an INFORMATIVE `review-round:<N>` label — derived from real state (the caller's
 *   own round number, e.g. `reconcile-pass.mjs`'s `attempts + 1`), never a second source of truth. Purely
 *   cosmetic: nothing reads this label back to make a decision — `we:scripts/conveyor/rearm-review.mjs`'s own
 *   durable `countRearmComments` read stays the ONE place the actual attempt count is derived from. If this
 *   label ever falls out of sync (a failed `gh` call, a skipped tag step), nothing breaks — it is a glanceable
 *   hint for a human scanning a PR list, not a gate.
 *
 * PURE CORE / IO SHELL split, matching `we:scripts/review-set-label.mjs`'s own shape: {@link planRoundLabelChange}
 * decides what changes (no fs/network), {@link tagReviewRound} is the one IO shell that reads/writes labels
 * through `we:scripts/lib/review-label-provider.mjs`'s already-tested `gh` port — reused, not re-shelled.
 */
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { createGhProvider } from '../lib/review-label-provider.mjs';
import { writeAllSync, writeLineSync } from '../lib/write-all-sync.mjs';

/** Matches this module's own label shape, and only this shape — never a stray `review-round-ish` name. */
export const ROUND_LABEL_RE = /^review-round:(\d+)$/;

/** @param {number|string} round @returns {string} */
export function roundLabel(round) {
  const n = Number(round);
  if (!Number.isInteger(n) || n <= 0) throw new Error(`review-round-tag: round must be a positive integer, got ${JSON.stringify(round)}`);
  return `review-round:${n}`;
}

/**
 * PURE: what to add/remove so `currentLabels` shows EXACTLY `review-round:<round>` and no stale round label —
 * `add: null` when nothing needs to change (idempotent, safe to call every tick).
 * @param {{round:number|string, currentLabels?:Array<{name?:string}|string>}} o
 * @returns {{add:string|null, remove:string[]}}
 */
export function planRoundLabelChange({ round, currentLabels = [] } = {}) {
  const desired = roundLabel(round);
  const names = currentLabels.map((l) => (typeof l === 'string' ? l : l?.name)).filter(Boolean);
  const stale = names.filter((n) => ROUND_LABEL_RE.test(n) && n !== desired);
  const alreadyCorrect = names.includes(desired) && stale.length === 0;
  return { add: alreadyCorrect ? null : desired, remove: stale };
}

/**
 * THE IO SHELL. Reads the PR's current labels, computes the change, applies it only if one is needed.
 * `provider` is injectable (mirrors `we:scripts/review-set-label.mjs`'s own `createGhProvider()` seam) so a
 * test asserts the exact `gh` argv with no subprocess, and a caller never hand-rolls a second `execFileSync`.
 * @param {{pr:number|string, repo:string, round:number|string, provider?:object}} o
 * @returns {{changed:boolean, label:string, removed:string[]}}
 */
export function tagReviewRound({ pr, repo, round, provider = createGhProvider() } = {}) {
  const currentLabels = provider.readLabels(repo, pr);
  const plan = planRoundLabelChange({ round, currentLabels });
  if (!plan.add && plan.remove.length === 0) return { changed: false, label: roundLabel(round), removed: [] };
  // `review-round:<N>` is an OPEN-ENDED label family — round 7 mints a brand new GitHub label the first time
  // it is ever reached, and `gh pr edit --add-label` refuses one that does not exist in the repo yet. Ensure
  // it (create-or-update, idempotent) before every apply, not as a one-time setup step.
  provider.ensureLabel(repo, roundLabel(round), { description: 'informative: how many review rounds this PR has been through (auto-managed)' });
  provider.setLabels(repo, pr, { add: plan.add ?? roundLabel(round), remove: plan.remove });
  return { changed: true, label: roundLabel(round), removed: plan.remove };
}

const IS_CLI = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));
if (IS_CLI) {
  const argv = process.argv.slice(2);
  const flag = (name) => (argv.find((a) => a.startsWith(`--${name}=`)) || '').slice(name.length + 3) || undefined;
  const pr = argv.find((a) => /^\d+$/.test(a));
  const repo = flag('repo');
  const round = flag('round');
  if (!pr || !repo || !round) {
    writeLineSync(2, 'usage: review-round-tag.mjs <pr> --repo=<owner/name> --round=<N>');
    process.exitCode = 2;
  } else {
    try {
      const result = tagReviewRound({ pr, repo, round });
      writeAllSync(1, `${JSON.stringify(result)}\n`);
    } catch (e) {
      writeLineSync(2, `error: ${String(e?.message ?? e)}`);
      process.exitCode = 1;
    }
  }
}

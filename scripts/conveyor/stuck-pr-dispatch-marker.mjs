/**
 * @file scripts/conveyor/stuck-pr-dispatch-marker.mjs
 * @description THE STUCK-PR WATCH's dispatch-marker comment (epic #3383) — split out of
 *   {@link ./stuck-pr-watch-core.mjs} into its own LIGHTWEIGHT file for one reason: this is the piece
 *   `we:scripts/operations/operator-queue.mjs` needs too (its own "STUCK — inspected" section reads the same
 *   marker back off a PR's comments), and `stuck-pr-watch-core.mjs` itself imports
 *   `we:scripts/conveyor/reconcile-core.mjs` for {@link ../reconcile-core.mjs#assessLiveness} — a module with a
 *   much heavier transitive import graph (via `rearm-review.mjs` → `review-set-label.mjs` → `merge-ai-prs.mjs`,
 *   which calls `promisify(execFile)` at module load time). `operator-queue.mjs`'s own test file mocks
 *   `node:child_process` down to `execFileSync` alone, and pulling that whole chain in through a single new
 *   import broke module load outright (`execFile` undefined at `merge-ai-prs.mjs`'s top level) — confirmed live
 *   while building this feature. Keeping the marker here, with NO import of `reconcile-core.mjs`, is what lets
 *   `operator-queue.mjs` read it without dragging that graph in.
 *
 * PURE: no fs / gh / clock / process.
 */

/** The stable FIRST LINE of the watch's own dispatch marker — single-sourced, mirroring
 *  `we:scripts/conveyor/stand-down.mjs#STAND_DOWN_MARKER`'s own contract. Distinct from the inspecting AGENT's
 *  own diagnostic comment (which opens "🔎 stuck-PR inspection" per its brief) so the two can never be
 *  miscounted as one another — this one says "the watch dispatched", that one says "the agent found X". */
export const STUCK_DISPATCH_MARKER = '🔎 stuck-PR inspection dispatched';

const EPISODE_LINE_RE = /^episode:\s*(.+)$/m;

/**
 * Build the watch's own dispatch-marker comment, posted the instant it decides to dispatch (never delegated to
 * the dispatched agent — see `we:scripts/conveyor/stuck-pr-watch.mjs`'s own header). The `episode:` line embeds
 * `activityAt` VERBATIM (not reformatted), so {@link alreadyDispatchedForEpisode}'s exact-string comparison can
 * never drift from what was recorded here.
 * @param {{stage:string, minutesSince:number, thresholdMinutes:number, activityAt:string, sessionSlug:string}} o
 * @returns {string}
 */
export function buildStuckDispatchComment({ stage, minutesSince, thresholdMinutes, activityAt, sessionSlug }) {
  return [
    STUCK_DISPATCH_MARKER,
    '',
    `episode: ${activityAt}`,
    '',
    `No progress (no new commit, label event, or comment) for ~${Math.round(minutesSince)}m while \`${stage}\` ` +
      `(threshold ${thresholdMinutes}m), and nothing live is working it. An inspection agent (\`${sessionSlug}\`) ` +
      'has been dispatched to find out why — **diagnosis only**: it will not change labels, code, or branches. ' +
      'It will post its findings as a separate comment.',
    '',
    '_Auto-detected by the stuck-PR watch (`we:scripts/conveyor/stuck-pr-watch.mjs`, epic #3383)._',
  ].join('\n');
}

/**
 * Every stuck-episode timestamp this watch has already recorded a dispatch for, read back off the PR's OWN
 * comment thread. Pure. A comment counts only when the marker is its LEADING line (mirrors
 * `we:scripts/conveyor/stand-down.mjs#countStandDownComments`'s own narrowing) — a human quoting the marker in
 * a reply never counts.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {string[]}
 */
export function stuckDispatchEpisodes(comments) {
  const out = [];
  for (const c of Array.isArray(comments) ? comments : []) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body !== 'string' || !body.trimStart().startsWith(STUCK_DISPATCH_MARKER)) continue;
    const m = EPISODE_LINE_RE.exec(body);
    if (m) out.push(m[1].trim());
  }
  return out;
}

/**
 * Has THIS exact stuck episode (keyed by `activityAt`) already been dispatched for? Pure. `null`/`undefined`
 * `activityAt` never matches anything (there is no episode to key on).
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @param {string|null|undefined} activityAt
 * @returns {boolean}
 */
export function alreadyDispatchedForEpisode(comments, activityAt) {
  if (activityAt === null || activityAt === undefined) return false;
  return stuckDispatchEpisodes(comments).includes(String(activityAt));
}

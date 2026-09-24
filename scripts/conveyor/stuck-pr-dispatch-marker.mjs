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

/** The leading prefix SHARED by both of this feature's own writes — the watch's dispatch marker above and the
 *  inspecting agent's diagnosis comment (`we:skills-src/conveyor/stuck-pr-inspect-brief.md`). Neither is
 *  progress on the PR, so the watch's activity clock must never count them (PR #2553 review: counting them
 *  reset the clock on every dispatch and minted a fresh "episode" each threshold, forever). */
export const STUCK_INSPECTION_COMMENT_PREFIX = '🔎 stuck-PR inspection';

/**
 * Is this comment body one of the stuck-PR feature's OWN writes (dispatch marker or inspection diagnosis)? Pure.
 * Leading-line narrowing, same as {@link stuckDispatchEpisodes} — a human quoting the marker mid-reply is still
 * a real human comment, so it still counts as progress.
 * @param {string|null|undefined} body
 * @returns {boolean}
 */
export function isStuckInspectionOwnComment(body) {
  return typeof body === 'string' && body.trimStart().startsWith(STUCK_INSPECTION_COMMENT_PREFIX);
}

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
      'is being dispatched to find out why — **diagnosis only**: it will not change labels, code, or branches. ' +
      'It will post its findings as a separate comment.',
    '',
    '_Auto-detected by the stuck-PR watch (`we:scripts/conveyor/stuck-pr-watch.mjs`, epic #3383)._',
  ].join('\n');
}

/** The stable FIRST LINE of the watch's RETRACTION of its own dispatch marker. The watch posts the marker
 *  BEFORE it launches the agent (so a failed comment never leaves an unrecorded live agent — PR #2553 review);
 *  if the launch itself then fails, this retraction reopens the episode so the next sweep retries it. It shares
 *  {@link STUCK_INSPECTION_COMMENT_PREFIX}, so it is never counted as progress either. */
export const STUCK_DISPATCH_RETRACTED_MARKER = '🔎 stuck-PR inspection dispatch failed';

/**
 * Build the retraction posted when the launch provably fails right after its marker was posted. Same
 * `episode:` line as {@link buildStuckDispatchComment}, so it cancels exactly that episode. It carries NO raw
 * error text: that goes to the watch's own log, never a public PR comment (the error line can hold the whole
 * agent argv).
 * @param {{activityAt:string}} o
 * @returns {string}
 */
export function buildStuckDispatchRetractionComment({ activityAt }) {
  return [
    STUCK_DISPATCH_RETRACTED_MARKER,
    '',
    `episode: ${activityAt}`,
    '',
    'The inspection agent announced above did NOT start (it failed before launch; see the watch\'s own log). '
      + 'The next sweep will try once more.',
    '',
    '_Auto-detected by the stuck-PR watch (`we:scripts/conveyor/stuck-pr-watch.mjs`, epic #3383)._',
  ].join('\n');
}

/** Comments in thread order: by `createdAt` when every comment carries one, else as given. Pure. */
function inThreadOrder(comments) {
  const list = Array.isArray(comments) ? comments : [];
  const at = (c) => (typeof c === 'object' && c ? Date.parse(c.createdAt) : NaN);
  if (!list.length || !list.every((c) => Number.isFinite(at(c)))) return list;
  return [...list].sort((a, b) => at(a) - at(b));
}

/**
 * How many times has THIS episode already been retracted? Pure. The watch retracts an episode at most once
 * ({@link MAX_RETRACTIONS_PER_EPISODE}), so a failure that repeats every sweep cannot post comments forever.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @param {string|null|undefined} activityAt
 * @returns {number}
 */
export function stuckDispatchRetractions(comments, activityAt) {
  if (activityAt === null || activityAt === undefined) return 0;
  let n = 0;
  for (const c of Array.isArray(comments) ? comments : []) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body !== 'string' || !body.trimStart().startsWith(STUCK_DISPATCH_RETRACTED_MARKER)) continue;
    const m = EPISODE_LINE_RE.exec(body);
    if (m && m[1].trim() === String(activityAt)) n += 1;
  }
  return n;
}

/** At most this many retractions per episode — so at most two marker+launch attempts per stuck episode. */
export const MAX_RETRACTIONS_PER_EPISODE = 1;

/**
 * Every stuck-episode timestamp this watch has already recorded a dispatch for, read back off the PR's OWN
 * comment thread. Pure. A comment counts only when the marker is its LEADING line (mirrors
 * `we:scripts/conveyor/stand-down.mjs#countStandDownComments`'s own narrowing) — a human quoting the marker in
 * a reply never counts. Comments are read in thread order: a later {@link STUCK_DISPATCH_RETRACTED_MARKER} for
 * an episode cancels the marker before it, and a later marker (the retry) re-records it.
 * @param {Array<{body?:string}|string>|null|undefined} comments
 * @returns {string[]}
 */
export function stuckDispatchEpisodes(comments) {
  const live = new Set();
  for (const c of inThreadOrder(comments)) {
    const body = typeof c === 'string' ? c : c?.body;
    if (typeof body !== 'string') continue;
    const lead = body.trimStart();
    // The retraction is checked first: `…dispatch failed` does not start with `…dispatched`, but keep the
    // order explicit so a future marker rename can't make one read as the other.
    const retracted = lead.startsWith(STUCK_DISPATCH_RETRACTED_MARKER);
    if (!retracted && !lead.startsWith(STUCK_DISPATCH_MARKER)) continue;
    const m = EPISODE_LINE_RE.exec(body);
    if (!m) continue;
    if (retracted) live.delete(m[1].trim());
    else live.add(m[1].trim());
  }
  return [...live];
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

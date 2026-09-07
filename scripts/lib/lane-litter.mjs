/**
 * @file scripts/lib/lane-litter.mjs
 * @description The shared "known-safe scratch litter" allowlist + cleanup core for `we:backlog/3568-*.md`.
 *
 * WHY THIS EXISTS. Live-observed 2026-09-07: 46 of 48 web-everything lanes were simultaneously DIRTY —
 * every one of them carrying only untracked scratch files (`.commit-msg.txt`, `.pr-body.md`, `.pr-body.txt`,
 * `review-*-output.json`, `commit-msg-fix-*.txt`) that `we:skills-src/conveyor/delivery-agent-brief.md`
 * explicitly instructs every delivery agent to write INSIDE its lane — while `lane-pool.mjs`'s `cmdRelease`
 * only ever dropped the lease marker, never the tree. The pool read 0 acquirable at once as a direct result.
 *
 * A release-time fix and a periodic reap pass both need to answer the exact same question — "is this file a
 * known-safe scratch file, safe to discard?" — and MUST agree, or the pool degrades again the moment either
 * one lags the other. This module is that single source of truth: `we:scripts/lane-pool.mjs#cmdRelease` and
 * `we:scripts/conveyor/lane-pool-health-watch.mjs` both import it rather than re-deriving it.
 *
 * PURE CORE / IO SPLIT:
 *   • {@link LANE_RELEASE_LITTER_ALLOWLIST}, {@link isAllowlistedLitterPath}, {@link planLitterCleanup} are
 *     PURE — no fs/git/process.
 *   • {@link cleanLaneLitter} is the one IO caller (`git status --porcelain` + a scoped `git clean -f --`
 *     per allowlisted path) — never a blanket `git clean -fdx` / `reset --hard`. A tracked-file modification,
 *     or any untracked file NOT on the allowlist, is left exactly as-is: this only shrinks the false-positive
 *     "dirty" set (#2267's data-loss guard), it never widens what counts as safe to discard.
 */
import { execFileSync } from 'node:child_process';

/**
 * The exact live-observed set of scratch files a delivery agent's own arc (`delivery-agent-brief.md`) writes
 * INSIDE its lane. Extend this list, don't loosen the mechanism, if another safe pattern is found later.
 * `*` matches any run of characters within one path segment (no directory traversal).
 * @type {string[]}
 */
export const LANE_RELEASE_LITTER_ALLOWLIST = [
  '.commit-msg.txt',
  '.pr-body.md',
  '.pr-body.txt',
  'review-*-output.json',
  'commit-msg-fix-*.txt',
];

/**
 * One allowlist glob → an anchored RegExp. Pure. `*` → `[^/]*` — NOT `.*` — so it stays within one path
 * segment, matching this file's own documented contract ("no directory traversal"): a candidate like
 * `review-foo/bar-output.json` must never match `review-*-output.json` just because `.*` would happily
 * consume the `/`. Everything else is escaped literally.
 */
function globToRegExp(pattern) {
  // `?` is a real regex meta-character (single-char wildcard) and was missing from this escape set — an
  // allowlist entry containing a literal `?` would otherwise silently widen its own match instead of being
  // escaped. `-` is deliberately NOT escaped: it is only special inside a `[...]` character class, and this
  // function never emits one (there is no `[...]` in the replacement), so an unescaped literal `-` is inert.
  const escaped = String(pattern).replace(/[.+^${}()|[\]\\?]/g, '\\$&').replace(/\*/g, '[^/]*');
  return new RegExp(`^${escaped}$`);
}

/**
 * Does this (relative) path match one of the allowlist's known-safe litter patterns? Pure.
 * @param {string} path
 * @param {string[]} [allowlist]
 * @returns {boolean}
 */
export function isAllowlistedLitterPath(path, allowlist = LANE_RELEASE_LITTER_ALLOWLIST) {
  const p = String(path || '');
  return allowlist.some((pattern) => globToRegExp(pattern).test(p));
}

/**
 * THE WHOLE DECISION: given a lane's raw `git status --porcelain` output, which paths are safe to discard and
 * which must be left exactly as `laneDirtyOrAhead` already sees them (still dirty, still correctly refused by
 * auto-pick)? Pure — no fs/git. Only an UNTRACKED entry (`??`) matching the allowlist is ever a candidate: a
 * tracked-file modification/staged change is never eligible no matter its name, since `git status --porcelain`
 * never reports those with the `??` prefix.
 *
 * Parses plain (not `-z`/NUL-terminated) porcelain output, so a filename git C-quotes (containing a quote,
 * backslash, or non-ASCII byte) would be read with its quoting still attached. Not a live gap: every
 * `LANE_RELEASE_LITTER_ALLOWLIST` pattern is a fixed, plain-ASCII prefix/suffix around a `[^/]*` segment, so no
 * name it can ever match requires C-quoting in the first place — this only matters if the allowlist is later
 * extended with a pattern permitting such characters, at which point switching to `-z` parsing here (and in
 * every caller) becomes load-bearing, not merely tidy.
 * @param {string|null} porcelain - raw `git status --porcelain` stdout (or null on a git failure).
 * @param {string[]} [allowlist]
 * @returns {{toRemove: string[], leaveDirty: string[]}}
 */
export function planLitterCleanup(porcelain, allowlist = LANE_RELEASE_LITTER_ALLOWLIST) {
  const lines = String(porcelain || '').split('\n').filter(Boolean);
  const toRemove = [];
  const leaveDirty = [];
  for (const line of lines) {
    const status = line.slice(0, 2);
    const path = line.slice(3).trim();
    if (status === '??' && isAllowlistedLitterPath(path, allowlist)) toRemove.push(path);
    else leaveDirty.push(path);
  }
  return { toRemove, leaveDirty };
}

const tryGit = (args, cwd) => {
  try {
    return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
  } catch {
    return null;
  }
};

/**
 * THE ONE IO CALLER. Reads `dir`'s current porcelain status, plans the cleanup ({@link planLitterCleanup}),
 * and — for every allowlisted untracked path — runs a PATH-SCOPED, literal-pathspec `git clean -f --`
 * (never `-d`/`-x`, never a bare `git clean -fdx` / `reset --hard`). Non-allowlisted dirty state, and any
 * TRACKED file sharing an allowlisted name, are left untouched. A failed status read returns `skipped: true`
 * — never conflated with "verified clean" (see the inline comment). `complete` is `true` only when every path
 * THIS call's own fresh read found removable was actually removed — judged against that fresh count, never a
 * caller's own (possibly stale) expectation of how many there should be.
 *
 * `isLeasedNow` (optional; `cmdRelease` omits it, `we:scripts/conveyor/lane-pool-health-watch.mjs` passes its
 * `defaultIsLeasedNow`) is the ONE knob for "no live occupant vouches for this lane, so be conservative" —
 * its mere presence ALSO requires `leaveDirty` to be EMPTY (the health-watch pass's own plan is built from an
 * earlier snapshot, and real dirty state can appear before this call runs; gating on this call's own fresh
 * read, not a separate caller pre-check, keeps read-then-act one atomic step). When given, it is additionally
 * re-checked before EVERY `git clean` call, not once up front — `toRemove` can hold several entries, and a
 * lane's status read alone cannot tell "old abandoned litter" from "a file a brand-new occupant just wrote",
 * so ownership must be re-verified as close to each mutation as possible. A `true` result stops the loop,
 * keeping whatever was already removed.
 * @param {string} dir - the lane's working tree.
 * @param {{allowlist?: string[], isLeasedNow?: ((dir: string) => boolean)|null}} [o]
 * @returns {{removed: string[], leaveDirty: string[], skipped: boolean, complete: boolean}}
 */
export function cleanLaneLitter(dir, { allowlist = LANE_RELEASE_LITTER_ALLOWLIST, isLeasedNow = null } = {}) {
  const porcelain = tryGit(['status', '--porcelain'], dir);
  // A `null` porcelain means the status read itself FAILED (dir vanished, permission fault, …) — this must
  // never be conflated with "verified clean, nothing to remove" (`planLitterCleanup(null)` would otherwise
  // report empty `toRemove`/`leaveDirty`, which reads identically to a genuinely clean lane). `skipped: true`
  // regardless of `isLeasedNow`: a caller that could not verify anything must never be told "not skipped" —
  // the SAME "read failure is never silently reported as clean" rule
  // `we:scripts/conveyor/lane-pool-health-watch.mjs#planLaneReap`'s own `read-error` action already applies.
  if (porcelain === null) {
    return { removed: [], leaveDirty: [], skipped: true, complete: false };
  }
  const { toRemove, leaveDirty } = planLitterCleanup(porcelain, allowlist);
  if (isLeasedNow && leaveDirty.length > 0) {
    return { removed: [], leaveDirty, skipped: true, complete: false };
  }
  const removed = [];
  for (const path of toRemove) {
    // Re-checked on EVERY iteration, not once before the loop: a multi-entry `toRemove` spans several
    // sequential `git clean` spawns, and checking only once up front would leave every removal AFTER the
    // first one unguarded if a lease were acquired mid-loop. A trip here is a DECLINE, not a partial success
    // — `complete` must read false, never derived from comparing against a caller's own (possibly stale)
    // count of what it expected to remove.
    if (isLeasedNow && isLeasedNow(dir)) {
      return { removed, leaveDirty, skipped: true, complete: false };
    }
    // `:(literal)` forces git's pathspec parser to match this LITERAL string, not a glob — without it, a
    // real filename that happens to contain a `*`/`?`/`[` (and still matches this module's own allowlist
    // regex, e.g. a file literally named `review-*-output.json`) would have git's OWN glob semantics expand
    // the pathspec and delete OTHER untracked files beyond the single one intended.
    // `tryGit` returns `null` on failure (never throws) — only count `path` as removed when the clean call
    // itself actually succeeded, not merely attempted.
    if (tryGit(['clean', '-f', '--quiet', '--', `:(literal)${path}`], dir) !== null) removed.push(path);
  }
  // `complete` is judged against THIS call's own freshly-computed `toRemove`, never a caller's earlier
  // snapshot — a caller comparing against a stale count would misjudge a lane whose real litter set changed
  // size between its snapshot and this call as incomplete even when this run fully succeeded (or vice versa).
  return { removed, leaveDirty, skipped: false, complete: removed.length === toRemove.length };
}

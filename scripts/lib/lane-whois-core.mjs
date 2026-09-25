/**
 * @file scripts/lib/lane-whois-core.mjs
 * @description The PURE decision core behind `scripts/lane-whois.mjs` (#3383). Everything here takes plain
 * data in and returns plain data out - no fs, no git, no `gh`, no clock read - so the classification (the part
 * worth getting right and keeping right) is unit-tested directly, mirroring this repo's existing PURE-core /
 * IO-shell split (`lane-lease.mjs`, `conveyor/lease-reaper.mjs`).
 */

/** Card-id shapes this repo actually uses: a plain number, or an `x`-prefixed 5-7 char slug (mirrors
 * `conveyor/lease-reaper.mjs`'s dispatcher-session grammar and `backlog/*.md` filenames). */
const CARD_ID_RE = /\b(\d{3,5}|x[a-z0-9]{5,7})\b/gi;

/**
 * PURE: guess which backlog card(s) a lane is (or was) working, from whatever local evidence is on hand -
 * changed/untracked file paths under `backlog/`, the HEAD commit subject, and the branch name. Best-effort:
 * over-inclusive is fine (a wrong guess is filtered out downstream by "does this card even exist on main"),
 * under-inclusive would silently blind a lane's whois to its own card.
 * @param {{ paths?: string[], commitSubject?: string, branch?: string }} evidence
 * @returns {string[]} unique card ids, in the order first seen.
 */
export function guessCardIds({ paths = [], commitSubject = '', branch = '' } = {}) {
  const found = [];
  const seen = new Set();
  const add = (id) => { const key = id.toLowerCase(); if (!seen.has(key)) { seen.add(key); found.push(id); } };
  for (const p of paths) {
    const m = /^backlog\/(\d{3,5}|x[a-z0-9]{5,7})-/i.exec(p);
    if (m) add(m[1]);
  }
  for (const text of [commitSubject, branch]) {
    if (!text) continue;
    for (const m of text.matchAll(CARD_ID_RE)) add(m[1]);
  }
  return found;
}

/** Terminal (won't-change-again) PR states, matched case-insensitively against `gh`'s own vocabulary. */
const TERMINAL_PR_STATES = new Set(['merged', 'closed']);

/**
 * PURE: does a card id appear, as a whole token (never a bare substring of a longer number/slug), in `text`?
 * Shared by {@link prsMatchingCard} below — one regex construction, not re-derived per call site.
 */
function idAppearsIn(id, text) {
  const escaped = String(id).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, 'i').test(text || '');
}

/**
 * PURE, speed follow-up (#3383's own perf note): `lane-whois.mjs` used to call `gh pr list --search <id>` ONCE
 * PER DISTINCT CARD ID (a network round-trip apiece — the dominant cost measured live against the real ~68-lane
 * WE pool, alongside the unbounded ref/commit fallbacks {@link aheadCommitsPreserved-adjacent code} in
 * `lane-whois.mjs` itself bounds). This is the in-process replacement: given the WHOLE repo's PR list (fetched
 * ONCE per run — `lane-whois.mjs#fetchAllPrs`), find every PR that mentions `cardId` as a whole token in its
 * title, head branch name, or body — the same three surfaces a card id realistically shows up in (a `WE #NNNN:`
 * title, a `lane/NNNN-*`/`lane/xSLUG-*` branch, or a body cross-reference). A card id embedded in a LONGER
 * number or slug (`"420"` inside `"4200"`) never matches — the same false-positive `gh --search`'s own
 * relevance ranking would also reject.
 * @param {Array<{number:number, state:string, title?:string, headRefName?:string, body?:string}>} prs
 * @param {string} cardId
 * @returns {Array<{number:number, state:string}>}
 */
export function prsMatchingCard(prs, cardId) {
  return (Array.isArray(prs) ? prs : [])
    .filter((pr) => pr && idAppearsIn(cardId, `${pr.title || ''} ${pr.headRefName || ''} ${pr.body || ''}`))
    .map((pr) => ({ number: pr.number, state: pr.state }));
}

/**
 * PURE: is a lease's holder presumed alive right now? A live lease (unexpired TTL) is a WEAKER signal than an
 * actually-listed live agent session - this just answers the TTL question; `lane-whois.mjs` layers the
 * `claude agents --json` cross-check on top for the stronger "owner alive -> ask" signal.
 */
export function holderPresumedAlive(lease, isLeaseStaleFn, nowMs, ttlMs) {
  return !!lease && !isLeaseStaleFn(lease, nowMs, ttlMs);
}

/**
 * PURE: the four-way verdict #3383 asks for - `in-use | finished-reclaimable | finished-needs-review |
 * unknown-work` - and WHY, from purely already-computed facts.
 *
 * RECLAIM RULE (mirrors the RECLAIM section of #3383's own brief verbatim): a lane is reclaimable only when
 * its card is resolved AND/OR its PR is MERGED/CLOSED (either signal suffices when both exist; whichever
 * signal actually exists must hold), AND every uncommitted/ahead change is PROVABLY present in main or on a
 * remote branch. A lane with NO uncommitted/ahead content at all has nothing to lose, so it is trivially
 * reclaimable regardless of card/PR state - resetting it destroys nothing.
 *
 * @param {object} p
 * @param {boolean} p.holderAlive - a live (unexpired) lease, or a `claude agents --json` hit for its owner.
 * @param {number} p.uncommittedCount - tracked-modified + untracked file count.
 * @param {number} p.aheadCount - local commits not on `origin/<branch>`.
 * @param {string[]} p.cardStatuses - `status` frontmatter field for every guessed card found on main (only the
 *   ones that actually resolved as a real card - a guessed id with no matching file is simply absent here).
 * @param {string[]} p.prStates - `state` for every PR found associated with this lane (`OPEN`/`MERGED`/`CLOSED`,
 *   case-insensitive).
 * @param {boolean} p.preserved - every uncommitted/ahead change is provably present in main or on a remote
 *   branch (vacuously true when there is no such content at all).
 * @returns {{ verdict: 'in-use'|'finished-reclaimable'|'finished-needs-review'|'unknown-work', reason: string }}
 */
export function classifyLaneVerdict({
  holderAlive, uncommittedCount = 0, aheadCount = 0, cardStatuses = [], prStates = [], preserved = true,
}) {
  if (holderAlive) return { verdict: 'in-use', reason: 'lease is live (holder presumed alive)' };

  const hasContent = uncommittedCount > 0 || aheadCount > 0;
  if (!hasContent) {
    return { verdict: 'finished-reclaimable', reason: 'no lease, no uncommitted/ahead content - nothing to lose' };
  }

  const cardsKnown = cardStatuses.length > 0;
  const prsKnown = prStates.length > 0;
  const cardsResolved = cardsKnown && cardStatuses.every((s) => s === 'resolved');
  const prsTerminal = prsKnown && prStates.every((s) => TERMINAL_PR_STATES.has(String(s).toLowerCase()));
  const doneSignal = cardsResolved || prsTerminal;

  if (doneSignal && preserved) {
    return {
      verdict: 'finished-reclaimable',
      reason: `${cardsResolved ? 'card(s) resolved' : 'PR(s) merged/closed'} and every change is provably preserved`,
    };
  }
  if (doneSignal) {
    return {
      verdict: 'finished-needs-review',
      reason: `${cardsResolved ? 'card(s) resolved' : 'PR(s) merged/closed'} but NOT every change is provably preserved - never auto-reclaim`,
    };
  }
  return {
    verdict: 'unknown-work',
    reason: cardsKnown || prsKnown
      ? 'card/PR found but still open - unclear if this lane duplicates live work'
      : 'no card or PR evidence at all for this content - needs a human look',
  };
}

/**
 * #4139 — PURE: does a lane's `keep` marker still apply to its CURRENT state? `lane-pool.mjs keep --lane=N`
 * records an operator's "I looked at this, leave it" call alongside a FINGERPRINT of the lane's content at
 * that moment (its HEAD sha, sorted dirty paths, sorted ahead-commit shas) — never a bare boolean — so the
 * decision is scoped to the exact content it was made about. The moment that content changes (a fresh
 * `acquire` resets the lane and it picks up new work, a new commit lands, a file changes), the OLD marker no
 * longer describes what is on disk, and this returns `false` so `we:scripts/lane-whois.mjs`'s report — and
 * downstream, `we:scripts/operations/operator-queue.mjs#laneReclaimQueue`'s "needs your decision" filter —
 * resurfaces the lane instead of trusting a stale call forever. This is the ONE place that comparison is made
 * (never re-derived at either call site), mirroring this file's own "PURE decision core, unit-tested with no
 * fs/git" convention.
 * @param {{fingerprint?: {headSha?: string, dirtyPaths?: string[], aheadShas?: string[]}}|null|undefined} marker
 *   the marker read from disk (`JSON.parse`d `.git/.lane-keep`), or `null`/`undefined` when none exists.
 * @param {{headSha: string, dirtyPaths: string[], aheadShas: string[]}} fingerprint the lane's CURRENT state,
 *   computed fresh by the caller (never trust a caller's stale copy — same discipline as
 *   {@link classifyLaneVerdict}'s own `preserved` re-derivation elsewhere in this codebase).
 * @returns {boolean}
 */
export function keepMarkerApplies(marker, fingerprint) {
  if (!marker || typeof marker !== 'object' || !marker.fingerprint || typeof marker.fingerprint !== 'object') return false;
  const sameArray = (a, b) => (
    Array.isArray(a) && Array.isArray(b) && a.length === b.length && a.every((v, i) => v === b[i])
  );
  const m = marker.fingerprint;
  return m.headSha === fingerprint.headSha
    && sameArray(m.dirtyPaths, fingerprint.dirtyPaths)
    && sameArray(m.aheadShas, fingerprint.aheadShas);
}

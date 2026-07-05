/**
 * @file scripts/lib/review-park-state.mjs
 * @description The durable "when did this PR FIRST park" marker the #2171 review-escalation watch-window
 *   gate (`decideReviewGate` in `review-escalation.mjs`) needs to fire its `merge-anyway` timeout branch.
 *
 * WHY (#2262): `decideReviewGate` already implements the timeout — an escalated PR with no reviewer verdict
 * merges anyway once `parkedSinceMs` is `windowMinutes` old — but the drain (`merge-ai-prs.mjs`) never had a
 * `parkedSinceMs` to give it (always `null`), so a deterministically-sampled PR (1-in-N floor, keyed on PR
 * number) re-scored `escalate` on EVERY pass and was re-parked forever: no reviewer daemon exists yet to apply
 * `review:accepted`, and the sampling floor cannot un-fire on its own. This module is the missing park-age
 * clock: the drain records the FIRST pass a PR parks, and every later pass reads that stamp back — once it is
 * older than the window, `decideReviewGate` returns `merge-anyway` and the PR is never permanently stranded.
 *
 * PURE — no fs, no `Date` reads. The CLI (`merge-ai-prs.mjs`) owns the fs boundary: it reads the state file
 * (tolerantly — a missing/corrupt file degrades to empty, never breaking the drain), calls these functions,
 * and writes the result back. Local, machine-scoped, best-effort: unlike `queued.json` (a durable cross-
 * session ready-to-merge signal every drain must honour), losing this file just resets the park clock — the
 * PR re-parks and starts a fresh window rather than being stranded, so a missing/corrupt file fails SAFE.
 */

/** A fresh, empty park-state (no file yet, or an unreadable one). */
export function emptyParkState() {
  return { parked: [] };
}

/** The stable key a (repo, PR#) pair is tracked under. `repo` is the `owner/name` slug, or `null`/`'cwd'`
 *  for the local repo the drain runs in — normalized so both spellings collide on the same entry. */
export function parkKey(repo, num) {
  return `${repo || 'cwd'}#${num}`;
}

/**
 * Tolerant parse of the park-state file text → normalized `{ parked: [{key, repo, num, sinceMs}] }`. NEVER
 * throws: bad JSON or junk rows degrade to empty rather than breaking the drain pass that reads it.
 * @param {string} text
 */
export function parseParkState(text) {
  if (!text || !text.trim()) return emptyParkState();
  let raw;
  try { raw = JSON.parse(text); } catch { return emptyParkState(); }
  const parked = Array.isArray(raw?.parked)
    ? raw.parked
        .filter((p) => p && p.num != null && Number.isFinite(Number(p.sinceMs)))
        .map((p) => ({ key: parkKey(p.repo ?? null, p.num), repo: p.repo ?? null, num: String(p.num), sinceMs: Number(p.sinceMs) }))
    : [];
  return { parked };
}

/** Serialize state back to file text (with a self-documenting `_doc` header). */
export function serializeParkState(state) {
  return JSON.stringify(
    {
      _doc:
        "The #2171/#2262 review-escalation park-age clock. Records the FIRST pass each escalated PR parked " +
        "(`review:pending`, no reviewer verdict yet) so the drain's watch-window gate can time out to " +
        "`merge-anyway` instead of re-parking a deterministically-sampled PR forever. Local, machine-scoped, " +
        "best-effort — safe to delete (a PR just re-parks and starts a fresh window).",
      parked: (state?.parked ?? []).map(({ repo, num, sinceMs }) => ({ repo, num, sinceMs })),
    },
    null,
    2,
  ) + '\n';
}

/** The recorded park-start time (ms) for `(repo, num)`, or `null` if it isn't tracked (never parked, or
 *  already cleared). Pure read — this is what the drain hands `decideReviewGate` as `parkedSinceMs`. */
export function getParkedSinceMs(state, { repo, num }) {
  const k = parkKey(repo, num);
  const entry = (state?.parked ?? []).find((p) => p.key === k);
  return entry ? entry.sinceMs : null;
}

/**
 * Mark `(repo, num)` parked as of `nowMs`. Idempotent: a PR already tracked keeps its ORIGINAL `sinceMs` (the
 * window counts from the first park, not the latest) — re-parking on a later pass never resets the clock.
 * Pure — returns new state.
 */
export function recordParked(state, { repo, num }, nowMs) {
  const k = parkKey(repo, num);
  const parked = state?.parked ?? [];
  if (parked.some((p) => p.key === k)) return state; // already tracked — keep the original stamp
  return { ...state, parked: [...parked, { key: k, repo: repo ?? null, num: String(num), sinceMs: Number(nowMs) }] };
}

/** Clear the park mark for `(repo, num)` — called once the PR leaves the parked set (merged, merge-anyway,
 *  or a reviewer verdict landed) so a LATER unrelated escalation starts its own fresh window. Pure, idempotent. */
export function clearParked(state, { repo, num }) {
  const k = parkKey(repo, num);
  const parked = state?.parked ?? [];
  if (!parked.some((p) => p.key === k)) return state; // nothing to clear — same reference, no-op
  return { ...state, parked: parked.filter((p) => p.key !== k) };
}

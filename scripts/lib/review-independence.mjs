/**
 * review-independence.mjs — WHO cleared a verdict, and the refusal when that is the same actor who authored
 * the PR (#2844, prevention M3 from the human `/review` on PR #982, under #2851).
 *
 * THE HOLE THIS CLOSES. Before this file, nothing recorded who cleared a verdict. `decideSetLabel`
 * (`we:scripts/review-set-label.mjs`) machine-refuses `→ accepted` on a `review:human` PR (INVARIANT 2,
 * #2416) — but a `review:pending` PR has no reviewer-identity check at all, so the independence bar
 * (#2398's distinct fresh validator, #2439's "the clearing agent must not be the author") rested on
 * CONVENTION, not code. An orchestrator wearing a reviewer hat could clear its own diff — including a diff
 * to `auto-land-seam.mjs` / `disposition-land-seam.mjs`, the two files that WRITE `review:accepted`.
 *
 * WHAT IDENTITY THIS RESTS ON, AND WHY IT IS THE DURABLE ONE AVAILABLE. `CLAUDE_CODE_SESSION_ID` — the
 * harness-supplied session identity #2367 already adopted as the AUTHORITATIVE lane-lease owner signal
 * (`we:scripts/lib/lane-lease.mjs#ownerSession`). It is inherited from the process environment, not read
 * from argv, and that distinction is the whole point: `--actor` is free text a caller sets at will (the
 * #2895 honesty tax says so in as many words), whereas the actor id here is stamped by whatever harness is
 * running and is the SAME string across a session's separate tool calls yet distinct between concurrent
 * sessions. The author's id is stamped ONCE, at PR-OPEN time, by a DIFFERENT tool (`we:scripts/pr-land.mjs`),
 * before any review exists and before the author knows it will later want to clear; the clearer's id is read
 * live at clear time. Comparing those two is a machine fact, where before there was no fact at all.
 *
 * SAY PLAINLY WHAT IT IS NOT (the #2895 discipline — a record trusted further than it earns is the failure
 * mode). This is NOT an unforgeable actor signal. #2895 RULED that deferred: no local construct survives an
 * agent with shell access on the same machine, and `env CLAUDE_CODE_SESSION_ID=…` is exactly such an agent's
 * escape. #2946 (a hardware human-presence gesture) is the durable fix. What this buys is that self-clearing
 * now takes a DELIBERATE FORGE of a value written by another tool at another time, instead of costing
 * nothing; and that every clearance record NAMES both parties, so a self-clear is visible after the fact.
 *
 * THEREFORE, FAIL CLOSED, AND FAIL CLOSED DIFFERENTLY PER PATH — a missing id is "independence NOT
 * established", never "independence assumed":
 *   • THE AUTONOMOUS PATH (`we:scripts/lib/auto-land-seam.mjs`, the seam that WRITES `review:accepted` with
 *     no human in the loop) requires `independent === true` and refuses everything else, INCLUDING both
 *     `unknown-*` statuses. A machine that cannot PROVE the clearer is not the author does not land. Today
 *     no caller can supply an author id for a PR opened before #2844, so the seam simply does not
 *     auto-land those — which is correct, and costs nothing operationally because `landMode` is
 *     SHADOW by default (ratified 2026-07-26) and no scheduled runner may flip it (#2830).
 *   • THE INVOKED CLI PATH (`we:scripts/review-set-label.mjs`, run by the operator's `/review` or by a
 *     conveyor agent) refuses a PROVEN `self-clear` on `--to=accepted` and otherwise proceeds — but when
 *     independence could not be established it says so verbatim in the durable comment rather than staying
 *     silent. A hard refusal on `unknown-author` there would strand every PR opened before this file existed,
 *     with a human unable to clear it; the honest record is the mitigation, exactly as #2895 chose.
 *   • THE HUMAN CEREMONY (`--to=clear-human`) IS EXEMPT FROM THE REFUSAL, and that exemption is load-bearing
 *     rather than a softening (PR #1100 review, THE BLOCKER). A SUBAGENT INHERITS ITS PARENT'S
 *     `CLAUDE_CODE_SESSION_ID` — verified, and `CLAUDE_CODE_CHILD_SESSION` is a boolean flag, not a finer id —
 *     so the comparison here is SESSION-level, and the operator's own `/review` ceremony shells the CLI from
 *     inside the very session that opened the PR. Refusing `clear-human` too therefore refused the operator's
 *     ENTIRE NORMAL WORKFLOW: nothing could be cleared through the sanctioned path, including the PR that
 *     introduced this file. The exemption is safe because `clear-human` already carries a STRONGER human
 *     signal than a session id: it is refused unless the PR actually carries `review:human`, and it demands
 *     an explicit `--actor` plus a quoted `--reason`, both posted verbatim. The durable comment records the
 *     exemption in as many words, so the audit trail reads "a human ceremony cleared it", never "an
 *     established-independent agent cleared it". `--to=accepted` — the AGENT verdict path — stays refused.
 *
 * NOT YET TRUST-CHAIN REGISTERED, AND THAT IS AN OWED FOLLOW-UP, NOT A CHOICE. This module DECIDES what may
 * clear the gate, which is the textbook `policy` tier in `we:scripts/lib/gate-config.mjs`'s own words — an edit
 * here should force `review:human`, exactly as it does for the seam that calls it. It is absent from `TRUST_CHAIN`
 * only because #2844 landed while a concurrent change (PR #1098) held the roster, and editing the leash
 * classification from two lanes at once is the merge hazard the roster exists to prevent. Today an edit here still
 * ESCALATES (the `^scripts/` blast-radius rule) but does not force a human. Register it as
 * `{ role: 'clearer-identity', file: 'review-independence.mjs', tier: 'policy' }` in the next roster edit.
 *
 * PURE except `currentActorId`, which reads one env var (and takes an injectable `env` so it is testable).
 * Deliberately a LEAF module: it imports nothing from the seams, so `review-set-label.mjs` can use it
 * without the import cycle a home inside `auto-land-seam.mjs` would create.
 */

/** The env var carrying the harness session identity — #2367's `ownerSession` signal, single-named here. */
export const ACTOR_ENV = 'CLAUDE_CODE_SESSION_ID';

/**
 * The CALLING actor's durable id — the harness session identity, NEVER an argv field. Returns '' when the
 * harness did not supply one (a bare shell, CI), which every consumer must treat as "not established".
 * @param {object} [env] - the environment to read (injected in tests).
 * @returns {string}
 */
export function currentActorId(env = process.env) {
  const raw = env && env[ACTOR_ENV];
  return typeof raw === 'string' ? raw.trim() : '';
}

/** The marker naming WHO opened the PR — stamped into the PR BODY once, at open, by `pr-land.mjs`. */
export const AUTHOR_ACTOR_MARKER = 'authored-by-actor';
/** The marker naming WHO cleared the verdict — stamped into the durable verdict COMMENT by review-set-label. */
export const CLEARER_ACTOR_MARKER = 'cleared-by-actor';

// An actor id is opaque, so the marker accepts any non-whitespace/non-`>` run — but bounded, so a runaway
// body can never make the scan quadratic, and `-->` can never be swallowed into the captured id.
const actorMarkerRe = (marker, flags) => new RegExp(`<!--\\s*${marker}:\\s*([^\\s>][^>]{0,199}?)\\s*-->`, flags);

/** Build an actor marker line. Pure. An empty/unusable id yields '' — no marker rather than a garbage one,
 *  so a reader sees "not established" instead of a value it would wrongly trust. */
function buildActorMarker(marker, id) {
  const v = typeof id === 'string' ? id.trim() : '';
  if (!v || v.length > 200 || /[<>\n]/.test(v)) return '';
  return `<!-- ${marker}: ${v} -->`;
}

/** The PR-body stamp naming the author's session. Pure. */
export function buildAuthorActorMarker(id) { return buildActorMarker(AUTHOR_ACTOR_MARKER, id); }
/** The verdict-comment stamp naming the clearer's session. Pure. */
export function buildClearerActorMarker(id) { return buildActorMarker(CLEARER_ACTOR_MARKER, id); }

/**
 * Every DISTINCT author-actor id a PR body carries, in the order first seen. Pure. Exported because the
 * PRESENCE of a stamp and the RESOLVED id are different questions: `pr-land.mjs#withAuthorStamp` must not
 * append a second stamp to a body that already carries one even when the body is ambiguous (see below), and
 * asking `parseAuthorActorId` would answer '' there and re-stamp on every re-run.
 * @param {string} body - the PR body.
 * @returns {string[]}
 */
export function readAuthorActorStamps(body) {
  const re = actorMarkerRe(AUTHOR_ACTOR_MARKER, 'g');
  const ids = new Set();
  let m;
  while ((m = re.exec(String(body || ''))) !== null) ids.add(m[1].trim());
  return [...ids];
}

/**
 * Read the AUTHOR's actor id out of a PR body — AGREEMENT-OR-NOTHING. One id (however many times it appears)
 * resolves; a body carrying two DIFFERENT author stamps is AMBIGUOUS and resolves to '' (i.e. `unknown-author`,
 * which the autonomous seam refuses outright and the invoked CLI records as "Independence NOT established").
 * Pure.
 *
 * SAY THE REAL PROPERTY, NOT A BIGGER ONE (PR #1100 review). The first cut selected the FIRST match and
 * justified it as "the stamp is written once at open, so a later stamp can only be someone re-writing history".
 * That reasoning is WRONG, and it was proved wrong: first-match is POSITIONAL, not temporal. A body has no
 * clock in it, so "first in the text" says nothing about "written first in time" — a forger who PREPENDS a
 * marker wins a first-match scan outright, which is the cheapest possible forge and precisely the one the old
 * comment claimed to stop. Agreement-or-nothing gives up on picking a winner, because there is no honest basis
 * to pick one, and fails CLOSED instead: a tampered body reads as unproven rather than as whichever id the
 * tamperer managed to position correctly.
 *
 * WHAT THIS STILL DOES NOT BUY, stated plainly (the file header's #2895 discipline). This is not tamper-proof
 * and cannot be: an actor able to edit the PR body can STRIP the original stamp and write its own, leaving a
 * single, self-consistent, independent-looking record. What agreement-or-nothing buys is that the LAZY forge —
 * adding a marker without removing the real one — no longer succeeds; it downgrades to unproven, where a
 * reader is told so. #2946 (a hardware human-presence gesture) remains the durable fix.
 *
 * @param {string} body - the PR body.
 * @returns {string} the id, or '' when the body carries no stamp OR carries conflicting ones.
 */
export function parseAuthorActorId(body) {
  const ids = readAuthorActorStamps(body);
  return ids.length === 1 ? ids[0] : '';
}

/**
 * Read the CLEARER's actor id out of a PR's comments. LAST match wins, mirroring `parseReviewedSha` — the
 * operative verdict is the latest one, and a re-verdict after a bounce must outrank the earlier record.
 * Carries the same forge residual `parseReviewedSha` documents: these are ordinary comments, not signatures.
 * Pure.
 * @param {Array<{body?:string}|string>} comments - the PR's comments (gh `--json comments` shape, or strings).
 * @returns {string} the id, or '' when no comment carries a stamp.
 */
export function parseClearerActorId(comments) {
  let latest = '';
  for (const c of Array.isArray(comments) ? comments : []) {
    const body = typeof c === 'string' ? c : (c && typeof c.body === 'string' ? c.body : '');
    const re = actorMarkerRe(CLEARER_ACTOR_MARKER, 'g');
    let m;
    while ((m = re.exec(body)) !== null) latest = m[1].trim();
  }
  return latest;
}

/**
 * The four independence STATUSES. Frozen so every caller names them once instead of matching on a string.
 * Only `INDEPENDENT` means "the clearer is provably not the author"; the other three all mean the bar was
 * NOT met, and differ only in WHY — which is what lets the autonomous seam refuse all three while the
 * invoked CLI refuses the proven self-clear and reports the two unprovens in the durable record.
 */
export const INDEPENDENCE = Object.freeze({
  INDEPENDENT: 'independent',         // both ids known and DIFFERENT — the #2439 bar is met, machine-checked
  SELF_CLEAR: 'self-clear',           // both ids known and EQUAL — the author is clearing its own verdict
  UNKNOWN_AUTHOR: 'unknown-author',   // no author stamp on the PR (opened before #2844, or outside pr-land)
  UNKNOWN_CLEARER: 'unknown-clearer', // the clearing process supplied no actor id (no harness session)
});

/**
 * THE PURE DECIDER (#2844) — is this clearance independent of the authorship? Compares the two durable actor
 * ids and returns a status plus a human reason. It DECIDES nothing about what to do: the autonomous seam
 * refuses on anything but `independent`, the invoked CLI refuses only `self-clear` (see the file header for
 * why the two paths differ). PURE — same inputs, same answer, no I/O.
 *
 * Comparison is exact-string after trimming, NOT case-folded: session ids are opaque tokens, and folding
 * case could only ever make two DIFFERENT ids look equal (a false self-clear) or, with a differently-cased
 * forge, make the same id look distinct — the second is the unsafe direction, so exact match it is.
 *
 * @param {{authorId?:string, clearerId?:string}} o
 * @returns {{independent:boolean, status:string, reason:string}}
 */
export function decideClearerIndependence({ authorId, clearerId } = {}) {
  const author = typeof authorId === 'string' ? authorId.trim() : '';
  const clearer = typeof clearerId === 'string' ? clearerId.trim() : '';

  if (!clearer) {
    return {
      independent: false,
      status: INDEPENDENCE.UNKNOWN_CLEARER,
      reason: `no clearing-actor id (${ACTOR_ENV} is unset in this process) — independence cannot be established, `
        + 'so it is not assumed (#2844)',
    };
  }
  if (!author) {
    return {
      independent: false,
      status: INDEPENDENCE.UNKNOWN_AUTHOR,
      reason: `the PR carries no ${AUTHOR_ACTOR_MARKER} stamp (opened before #2844, or outside pr-land) — there is `
        + 'nothing to compare the clearer against, so independence is unproven, not assumed',
    };
  }
  if (author === clearer) {
    return {
      independent: false,
      status: INDEPENDENCE.SELF_CLEAR,
      // NO REMEDY IS NAMED HERE, on purpose (PR #1100 review). The first cut ended "hand the verdict to a
      // different session, or let a human clear it" — and the second half MISDIRECTED, because a subagent
      // inherits its parent's session id, so the human running `/review` IS this same actor and "let a human
      // clear it" pointed at a door that was also shut. What actually works differs per caller (the CLI has the
      // `clear-human` ceremony; the autonomous seam has no ceremony at all), so each caller names its own routes
      // and this shared decider states only the FACT.
      reason: `SELF-CLEAR REFUSED — the clearing actor (${clearer}) is the PR's author; the clearing agent must not `
        + 'be the author (#2439, applying #2398\'s distinct-fresh-validator bar). Note that a subagent INHERITS its '
        + `parent's ${ACTOR_ENV}, so every agent spawned by the session that opened this PR is this same actor`,
    };
  }
  return {
    independent: true,
    status: INDEPENDENCE.INDEPENDENT,
    reason: `independent — the clearing actor (${clearer}) is not the PR's author (${author})`,
  };
}

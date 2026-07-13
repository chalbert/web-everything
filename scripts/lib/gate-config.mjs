/**
 * gate-config.mjs — the AUTO-REVIEW TRUST CHAIN as explicit, versioned config (#2448, under #2445).
 *
 * WHAT THIS IS. The one class of change an *agent* reviewer may not clear is an edit to the machinery
 * that decides whether the review gate fires and what clears it — the "trust chain". Reviewing such a
 * change, an auto-reviewer would be policing an edit to its own leash (a genuine conflict of interest),
 * so a human is *essential* (`review:human`). This file is the SINGLE SOURCE OF TRUTH for which paths
 * are trust-chain paths. `isGateSelfPath` (in ./review-escalation.mjs) derives from it — nothing else
 * hardcodes the set.
 *
 * WHY IT LIVES HERE, AS CONFIG (#2448). Before this, the set was literal regexes buried in the scorer
 * (`GATE_SELF_PATHS` pinned to `scripts/lib/…` / `scripts/merge-ai-prs.mjs`). That silently un-anchors
 * the moment the delivery engine is extracted OUT of `we:scripts/` — the whole point of the parent epic
 * (#2445: a resident coordinator, hosted in plateau-app or its own repo). A PR editing the relocated
 * engine would no longer match the literals, so it would stop tripping `gate-self` and become
 * agent-clearable — the `review:human` invariant (exercised on PR #423) evaporating with no failing
 * test. Hoisting the set into explicit config that TRAVELS WITH the code fixes that.
 *
 * HOW IT TRAVELS (the load-bearing design). Each member is matched by its **basename**, not its full
 * path. A basename match is independent of directory and repo prefix, so relocating a member — into a
 * plateau-app module, a new package dir, or an entirely separate repo — keeps it gate-self for free
 * (`plateau-app/tools/loop/review-escalation.mjs` still trips, just like `frontierui/scripts/…` does
 * today). Basename matching is strictly MORE inclusive than the old anchored regexes, so it can only
 * ever over-escalate (force a human where one wasn't strictly needed) — the safe direction, by policy.
 * The ONE thing basename match cannot follow is a RENAME: relocate-and-rename a member and you must
 * re-register it below. That is deliberate — see the closure note.
 *
 * SELF-HOSTING BOUNDARY — the #2285 invariant, ONE LEVEL UP (#2445 DoD, #2448). When the delivery
 * engine becomes a resident coordinator that drains its own PRs, the coordinator must never be the sole
 * reviewer-and-lander of a change to *itself*. That is not a new mechanism: it is this trust chain
 * applied one level up. The coordinator's own source files are trust-chain members — register their
 * basenames here and a PR editing the coordinator derives `humanRequired: true`, so the coordinator
 * *cannot* auto-clear it; a human must. Enforced by construction (the basename match already follows the
 * code across repos), not assumed. As the coordinator gains gate-critical files, add them to `TRUST_CHAIN`
 * — that is the whole self-hosting design: the roster is the boundary, and it is versioned config the
 * extraction carries.
 *
 * THE CLOSURE (why this file is itself gate-self). `gate-config.mjs` and the tripwire suite
 * `gate-invariants.test.mjs` are BOTH registered below, so editing the roster — or the invariants that
 * pin its properties — is itself a trust-chain change that forces `review:human`. You cannot quietly
 * DROP a member, RENAME one without re-registering, or weaken an invariant to make a diff pass: every
 * such change is human-reviewed by construction. That is the point.
 */

/**
 * The trust chain, as explicit versioned config. Each entry is one member of the machinery that decides
 * the review gate. `file` is the matched basename (the travels-across-repos matcher); `role`/`desc` are
 * documentation; `homes` records the current known location(s) purely for auditability (the matcher does
 * NOT read `homes` — a member at any path with a registered basename is gate-self). When a member moves,
 * update `homes` for the record; when a member is RENAMED, you must change `file` — the one edit basename
 * matching cannot do for you.
 *
 * Keep this list MINIMAL. `review:human` = "human judgment essential", not merely "important" — a wider
 * net just re-strands the queue on humans. Only code that decides *whether the gate fires and what clears
 * it* belongs here; everything else in blast-radius stays agent-reviewable.
 */
export const TRUST_CHAIN = [
  {
    role: 'escalation-rubric',
    file: 'review-escalation.mjs',
    desc: 'the escalation rubric itself — decides whether the gate fires and what clears it',
    homes: ['scripts/lib/review-escalation.mjs'],
  },
  {
    role: 'disposition-router',
    file: 'review-core.mjs',
    desc: 'the converge-vs-human router (deriveReviewDisposition) + the negotiation round caps — decides whether an agent may clear an escalated PR or a human must; editing it changes what the gate does with an escalation',
    homes: ['scripts/lib/review-core.mjs'],
  },
  {
    role: 'lander',
    file: 'merge-ai-prs.mjs',
    desc: 'the lander that reads the verdict labels and decides to merge',
    homes: ['scripts/merge-ai-prs.mjs'],
  },
  {
    role: 'roster-config',
    file: 'gate-config.mjs',
    desc: 'THIS file — the trust-chain roster; editing it is itself a trust-chain change (the closure)',
    homes: ['scripts/lib/gate-config.mjs'],
  },
  {
    role: 'invariants',
    file: 'gate-invariants.test.mjs',
    desc: 'the tripwire suite proving the safety invariants of the members above (weakening one is human-only)',
    homes: ['scripts/lib/__tests__/gate-invariants.test.mjs'],
  },
];

/** The set of trust-chain basenames — the derived matcher input. Frozen so a consumer can't mutate it. */
export const TRUST_CHAIN_BASENAMES = Object.freeze(new Set(TRUST_CHAIN.map((m) => m.file)));

/** The basename of a repo-relative (or repo-prefixed) path. Pure — `a/b/c.mjs` → `c.mjs`, `c.mjs` → `c.mjs`. */
export function basenameOf(path) {
  const p = String(path || '');
  const cut = p.lastIndexOf('/');
  return cut === -1 ? p : p.slice(cut + 1);
}

/**
 * Does this repo-relative path edit the auto-review trust chain (→ a human review is essential)? Pure.
 * Basename-based so it follows a member across directories and repos (see file header). This is the
 * canonical predicate; `review-escalation.mjs` re-exports it as `isGateSelfPath` for its existing callers.
 */
export function isTrustChainPath(path) {
  return TRUST_CHAIN_BASENAMES.has(basenameOf(path));
}

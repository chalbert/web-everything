/**
 * gate-config.mjs — the AUTO-REVIEW TRUST CHAIN as explicit, versioned config (#2448, under #2445).
 *
 * WHAT THIS IS. The trust chain is the machinery whose edits are too sensitive to auto-clear. It has TWO
 * tiers (#2445 two-tier flip):
 *   • POLICY tier — the code that DEFINES whether the gate fires and what clears it (the rubric, the
 *     disposition router, this roster, the invariants). Reviewing a change here, an auto-reviewer would be
 *     policing an edit to its own leash (a genuine conflict of interest), so a human is *essential*
 *     (`review:human`). `isPolicyCorePath` / `isGateSelfPath` select this tier.
 *   • ENGINE tier — the lander, which OBEYS the gate but does not define it. A change here still ESCALATES
 *     and runs the full adversarial panel, but a converged agent verdict may clear it (agent-reviewable);
 *     the policy-tier invariant suite (human-only) is the backstop that catches a lander edit that tries to
 *     bypass a verdict. This is the deliberate relaxation that lets the delivery engine improve itself
 *     without a mandatory human on every lander patch, while the leash-defining tier stays human.
 * This file is the SINGLE SOURCE OF TRUTH for both tiers; nothing else hardcodes the set.
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
 * SELF-HOSTING BOUNDARY — the #2285 invariant, ONE LEVEL UP (#2445 DoD, #2448, two-tier flip). When the
 * delivery engine becomes a resident coordinator that drains its own PRs, the coordinator must never be the
 * sole reviewer-and-lander of a change to the code that DEFINES its own leash. That is the POLICY tier: the
 * rubric, the disposition router, this roster, the invariants — register their basenames here as `policy` and
 * a PR editing them derives `humanRequired: true`, so the coordinator *cannot* auto-clear it; a human must.
 * The coordinator's ENGINE (its lander) is a different case: it obeys the leash rather than defining it, so it
 * is `engine` tier — it still escalates and runs the full panel, but a converged verdict may land it. Enforced
 * by construction (the basename match follows the code across repos), not assumed. As the coordinator gains
 * gate-critical files, add them to `TRUST_CHAIN` with the right tier — that is the whole self-hosting design:
 * the roster is the boundary, and it is versioned config the extraction carries.
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
 * Each member also carries a `tier`: `policy` (edits force `review:human` — the leash-defining code) or
 * `engine` (edits escalate + run the panel but a converged agent verdict may clear them — the lander that
 * obeys the leash). Keep the POLICY tier MINIMAL: `review:human` = "human judgment essential", not merely
 * "important" — a wider policy net just re-strands the queue on humans. Only code that decides *whether the
 * gate fires and what clears it* is `policy`; everything else (incl. the lander) is agent-reviewable.
 */
export const TRUST_CHAIN = [
  {
    role: 'escalation-rubric',
    file: 'review-escalation.mjs',
    tier: 'policy',
    desc: 'the escalation rubric itself — decides whether the gate fires and what clears it',
    homes: ['scripts/lib/review-escalation.mjs'],
  },
  {
    role: 'disposition-router',
    file: 'review-core.mjs',
    tier: 'policy',
    desc: 'the converge-vs-human router (deriveReviewDisposition) + the negotiation round caps — decides whether an agent may clear an escalated PR or a human must; editing it changes what the gate does with an escalation',
    homes: ['scripts/lib/review-core.mjs'],
  },
  {
    role: 'lander',
    file: 'merge-ai-prs.mjs',
    tier: 'engine',
    desc: 'the lander that reads the verdict labels and decides to merge — it OBEYS the gate (it does not define whether the gate fires or what clears it), so it stays agent-reviewable; a change here still escalates and runs the full adversarial panel, and the policy-tier invariant suite (human-only) is the backstop that catches a lander edit that tries to bypass a verdict',
    homes: ['scripts/merge-ai-prs.mjs'],
  },
  {
    role: 'roster-config',
    file: 'gate-config.mjs',
    tier: 'policy',
    desc: 'THIS file — the trust-chain roster; editing it is itself a trust-chain change (the closure)',
    homes: ['scripts/lib/gate-config.mjs'],
  },
  {
    role: 'invariants',
    file: 'gate-invariants.test.mjs',
    tier: 'policy',
    desc: 'the tripwire suite proving the safety invariants of the members above (weakening one is human-only)',
    homes: ['scripts/lib/__tests__/gate-invariants.test.mjs'],
  },
];

/** The set of ALL trust-chain basenames (both tiers) — the derived matcher input. Frozen. A trust-chain path
 *  ALWAYS escalates (gets an independent review), whether it is policy or engine tier; the tier only decides
 *  whether a HUMAN is essential (policy) or a converged agent panel may clear it (engine). */
export const TRUST_CHAIN_BASENAMES = Object.freeze(new Set(TRUST_CHAIN.map((m) => m.file)));

/** The POLICY-tier basenames — the code that DEFINES whether the gate fires and what clears it. ONLY these
 *  (plus statute, handled in review-escalation.mjs) force `review:human`: an agent reviewing a change to the
 *  gate's own decision logic would be policing its own leash. The ENGINE tier (the lander) OBEYS the gate, so
 *  a change there is agent-reviewable like any other blast-radius edit. Frozen. */
export const POLICY_CORE_BASENAMES = Object.freeze(new Set(TRUST_CHAIN.filter((m) => m.tier === 'policy').map((m) => m.file)));

/** The basename of a repo-relative (or repo-prefixed) path. Pure — `a/b/c.mjs` → `c.mjs`, `c.mjs` → `c.mjs`. */
export function basenameOf(path) {
  const p = String(path || '');
  const cut = p.lastIndexOf('/');
  return cut === -1 ? p : p.slice(cut + 1);
}

/**
 * Does this repo-relative path edit ANY trust-chain member (policy OR engine)? Pure. A trust-chain path always
 * ESCALATES — even a relocated engine file (e.g. an extracted lander at `packages/plateau-loop/src/…`) that no
 * longer matches the `^scripts/` blast-radius pattern must still get an independent review. Basename-based so
 * it follows a member across directories and repos (see file header).
 */
export function isTrustChainPath(path) {
  return TRUST_CHAIN_BASENAMES.has(basenameOf(path));
}

/**
 * Does this repo-relative path edit the POLICY CORE — the code that decides whether the gate fires and what
 * clears it (→ a human review is essential)? Pure. This is the narrowed successor to the old "any trust-chain
 * path ⇒ human" rule (#2445 two-tier flip): only the policy tier forces `review:human`; the engine tier (the
 * lander) stays agent-reviewable. `review-escalation.mjs` re-exports this as `isGateSelfPath`.
 */
export function isPolicyCorePath(path) {
  return POLICY_CORE_BASENAMES.has(basenameOf(path));
}

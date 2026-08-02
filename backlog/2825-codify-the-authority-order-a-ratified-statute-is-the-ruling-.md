---
bornAs: xyfr77r
kind: story
size: 3
parent: "2527"
status: open
dateOpened: "2026-08-02"
relatedTo: ["2771", "2785", "2821"]
tags: [authority-order, statute, provenance, review, governance, working-style]
---

# Codify the authority order — a ratified statute is the ruling, code is its implementation status

When code and a ratified statute disagree, the **statute is the ruling** and the **code is its implementation
status**. Any routing or behavior claim ("this PR routes to X", "this touch parks `review:human`") must resolve
against `we:docs/agent/platform-decisions.md` **first**, and only then note whether the running code has caught
up. A `tier:` field, a rubric function, a live `humanRequired` return describe *what is built*, not *what was
decided* — the easy-to-grep artifact is not the authority.

## Why this exists — #957 round 5 is the proof

The authority order is a rule that nothing states, so a careful reader inverts it by default (the code is the
thing that is easy to grep). #957 is first-hand proof that it gets inverted:

- **A reviewer inverted it.** Round 4 of the #957 review asserted, from `we:scripts/lib/gate-config.mjs`'s
  `tier: 'policy'` field, that an implementing diff touching `we:scripts/lib/review-core.mjs` must be
  re-declared `review:human` / care `high`. That reads the **code** as the authority.
- **A lane inverted it.** The author lane implemented that instruction faithfully and thoroughly — reverting the
  item's correct "rides the normal independent review" to a human gate.
- **The statute said the opposite the whole time.** `we:docs/agent/platform-decisions.md#review-human-declarative-leash-only`
  ([#2771], ratified 2026-07-28) splits the policy tier: the **declarative leash** stays `review:human`, but
  **derivation code** (`we:scripts/lib/review-escalation.mjs`, `we:scripts/lib/review-core.mjs`,
  `we:scripts/lib/review-policy.mjs`) routes to the sized independent **committee** (`review:pending`) at care
  `elevated`. The reason today's `scoreEscalation` still returns `humanRequired` for a derivation-code touch is
  only that the narrowing implementation ([#2785], `blockedBy` #2771) is still **open** — the code has not caught
  up with the ruling. Round 5 retracted the round-4 error.

This is the *same root class* [#2821] is built on — a claim asserted without resolving it against the
authoritative source — with the **reviewer** as the author and the **statute layer** as the source that was
skipped. Every gate in [#2821] so far watches the authoring side; this rule names the order the review side must
follow.

## What lands

The ordering is worth more than any single gate, so it is codified in the two places a reviewer or author will
actually meet it:

1. **A `we:docs/agent/platform-decisions.md` statute** — a short anchor stating the authority order: a ratified
   statute is the ruling; code is its implementation status; a routing/behavior claim resolves against the
   statute layer first, and only then notes whether the code has caught up (cross-referencing [#2821]'s
   ruled-but-not-yet-implemented marker for the window where a ratified rule's implementation is still `open`).
2. **An agent-memory working-style rule** — a one-line recall rule ("statute-first: resolve any routing/behavior
   claim against `we:docs/agent/platform-decisions.md` before trusting a `tier:` field / rubric / live return")
   so it is loaded into context when a reviewer or author is about to make exactly this kind of claim.

## Acceptance

- The authority-order rule is **stated where reviewers and authors will see it** — as a ratified anchor in
  `we:docs/agent/platform-decisions.md` and as an agent-memory working-style rule (the two surfaces a
  routing/behavior claim is made from).
- The statute names the statute-vs-code disagreement window and points at [#2821]'s ruled-but-not-yet-implemented
  marker (gate 9) for how the gap is surfaced while an implementation follow-on is still `open`.
- #957 round 5 is cited as the proof instance (a reviewer + a lane both inverted the order).

## Related

Proof instance: the #957 review (rounds 4–5). Statute that was skipped: [#2771] (`#review-human-declarative-leash-only`);
its open implementation follow-on [#2785] is why the code still behaved the old way. Enforcement family:
[#2821] (ratify-gate + provenance hooks — its gate 9 renders the ruled-but-not-yet-implemented marker). Under
epic [#2527].

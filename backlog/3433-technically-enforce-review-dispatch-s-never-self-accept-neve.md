---
bornAs: xf38r2m
kind: story
size: 5
parent: "3279"
status: open
scope: ["we:scripts/operations/review-dispatch.mjs", "we:skills-src/review/review-agent-brief.md"]
dateOpened: "2026-08-31"
tags: []
---

# Technically enforce review-dispatch's never-merge rule, and review:human's never-self-accept rule, against a compromised dispatched session

Independent-review finding (PR #1756 r1, security lens, CONFIRMED): the dispatched review session's "never self-accept, never merge" rule lived only as PROSE in we:skills-src/review/review-agent-brief.md. Nothing technically restricted its tools, so a prompt-injection payload embedded in the reviewed PR's own diff/description could in principle talk it into running `--answer=accept` or a merge command directly, bypassing we:scripts/operations/review-loop-cli.mjs's own code-enforced refusal entirely. Needs a technical mitigation (a restricted tool/permission default, or a wrapper refusing that argv) rather than prose alone. Filed rather than blocking #3279's land, mirroring the #2895 precedent: state the residual honestly, defer the hardening.

## Re-scoped for `#3434` (2026-09-01) — RECONCILIATION, per that decision's own "Done when" #4

`#3434` (ratified) made a genuinely independent `accept` verdict on a `review:pending` PR clear MECHANICALLY —
`we:scripts/lib/review-loop-policy.mjs`'s `reviewLoopAutoConfirm` itself now answers `accept` (and, per `#3442`,
`prevention-outstanding` too) for that tier, unattended, by design. That REMOVES this item's original premise
for `review:pending`: a dispatched session recording an accept on that tier is no longer a bypass to harden
against — it is the ratified mechanism working as intended, and its own independence guard (the two-juror
read→judge→reduce pipeline, unrelated to tool restriction) is what actually backs it, not a "never self-accept"
rule. Narrowed accordingly, never left standing against the new doctrine:

- **STILL IN SCOPE — `review:human`'s never-self-accept.** `#3434` explicitly left this tier's human-only
  ceremony (`--to=clear-human`) UNCHANGED ("yes review human are for human," operator, 2026-09-01) — a dispatched
  session must still never be able to talk itself into clearing a `review:human` PR. This is exactly the
  original PR #1756 finding, just scoped to the ONE tier where "never self-accept" is still the rule.
- **STILL IN SCOPE — never-merge, both tiers.** `#3434` does not touch `gh pr merge` / `gh pr merge -X PUT` at
  all; a dispatched review session (whichever tier's PR it is reviewing) running that command directly is
  unrelated to the accept-mechanism change and remains exactly the vulnerability class PR #1756 flagged.
- **DROPPED — `review:pending`'s self-accept.** No longer a thing to harden against; hardening it would fight
  the ratified mechanism `#3434`/`#3442` intentionally built.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after, covering ONLY the two
   still-in-scope cases above: (a) a compromised dispatched session cannot clear a `review:human` PR's
   `review:accepted`, and (b) a compromised dispatched session cannot merge the PR it is reviewing, on either
   tier.

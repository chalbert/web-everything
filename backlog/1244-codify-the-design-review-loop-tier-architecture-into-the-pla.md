---
kind: story
size: 3
parent: "1033"
status: resolved
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "docs/agent/platform-decisions.md#vision-tiers"
relatedProject: webdocs
tags: [design-review, vision, codification, statute]
---

# Codify the design-review-loop tier architecture into the platform-decisions statute layer

Closing slice of the interactive design-review-loop epic (#1033): its four build children shipped (the vision-tiers rubric, the review-design skill, the plateau review surface, the correction harness), so the loop is live. The remaining strand is the codification the epic body defers — promote the stable parts of we:docs/agent/vision-tiers.md (the Tier 1 → Tier 2/hosted cascade, which capability is used where) into the statute layer we:docs/agent/platform-decisions.md. Settle any still-open tier fork as part of this pass; once codified, #1033 resolves.

## Progress

Resolved 2026-06-20. Added the statute rule **`{#vision-tiers}`** ("Vision capability tiers — the
on-device-first cascade") to we:docs/agent/platform-decisions.md, in the vision cluster right after
[#no-leakage-client]. It codifies the stable parts of we:docs/agent/vision-tiers.md: the three tiers
(Tier 1 verdict classifier / Tier 2 small VLM / hosted) with their jobs + limits, the **selection rule**,
and the **load-bearing cascade** (Tier 1 gates every expensive call → affordable under flat pricing),
the deployment floor (Tier 1 bundled-default; Tier 2 opt-in dev-browser download; hosted BYO-key/premium),
and the single `registerVisionProvider` seam. Specializes [#no-leakage-client] + [#monetization]; carries
a `*Confidence:*` line (architecture firm; on-device-vs-hosted for the rich tier provisional).

**No open tier fork to settle** — the only soft strand (Tier-2-class critique model on-device vs. hosted)
is an explicitly-deferred *later call*, not a blocking fork: the provider seam absorbs the choice either
way, so it's codified AS deferred (a named "Still deferred" clause) rather than forced. The
we:docs/agent/vision-tiers.md status note now points at the statute anchor (cite the rule, don't re-derive); it stays the detailed
reference behind the rule. Gate green. This is the closing slice of epic #1033 (all four build children +
this codification now done).

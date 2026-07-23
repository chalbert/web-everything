---
bornAs: xjnmv6d
kind: story
size: 5
buildQueued: true
parent: "2636"
status: open
blockedBy: ["2634"]
scope: ["we:skills-src/prepare-decision-item/", "we:scripts/lib/review-core.mjs"]
dateOpened: "2026-07-23"
tags: []
---

# Prepare-time jury charter: pre-register jury and expectations for early human alignment

The early-human-alignment gate (settled design call). At prepare/claim, author a *provisional* jury plus each juror's up-front expectation as an artifact on the item — so the human aligns on the review bar **before** any code is written, and the pre-registered expectations kill post-hoc goalpost-moving. **Care-gated**: aligning every juror up front is real cost, so skip it for `low` care and only run it for elevated/high (reuse the same care dial that sizes rigor). Wire the charter authoring into the prepare/claim path (`we:skills-src/prepare-decision-item/`) and derive the provisional roster from `we:scripts/lib/review-core.mjs`. Depends on the lens/method split for what a juror *is*.

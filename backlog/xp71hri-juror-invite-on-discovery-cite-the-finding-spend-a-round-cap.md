---
kind: story
size: 5
parent: "x8lajxj"
status: open
blockedBy: ["xomlggf"]
scope: ["we:scripts/lib/review-core.mjs", "we:scripts/workflows/review-parked-prs.mjs"]
dateOpened: "2026-07-23"
tags: []
---

# Juror-invite-on-discovery: cite the finding, spend a round, capped by care band

Account for a jury that grows mid-review: a juror who finds a discovery opening a new failure axis (e.g. a correctness reviewer notices a security hole) can invite another lens/method. Model it as "the discovery raises care-level → recompute rigor → spawn only the delta." Guardrails so it grows *only with reason*: the invite must **cite the finding** that justifies it (grounding), it **spends a round-trip and never resets the counter** (so a chain of invites can't dodge the cap), and the per-care-band ceiling bounds total jurors. Build in `we:scripts/lib/review-core.mjs` (the care recompute + delta) and `we:scripts/workflows/review-parked-prs.mjs` (the loop that spawns the invited juror). Depends on the convergence loop.

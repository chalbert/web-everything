---
bornAs: x9kpvl3
kind: story
size: 2
parent: "2636"
status: open
blockedBy: ["2634"]
scope: ["we:scripts/lib/review-core.mjs"]
dateOpened: "2026-07-23"
tags: []
---

# Red-team the jury selection: completeness critic on the roster pick

Make the jury *selection* itself trustworthy, not just the diff review. After the roster is picked (at prepare and again at open), run one cheap completeness critic — the adversarial "what failure axis is unguarded here?" pass — that red-teams the pick for a missed lens/method (e.g. it forgot a11y on a UI change, or perf on a hot-path edit). What it surfaces is added to the roster before the jury runs. Small, standalone: builds on the lens/method registry in `we:scripts/lib/review-core.mjs` and attaches wherever a roster is resolved. Depends only on the lens/method split.

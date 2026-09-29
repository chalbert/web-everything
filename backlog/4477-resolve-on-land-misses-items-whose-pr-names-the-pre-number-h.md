---
bornAs: x58f8u5
kind: story
size: 2
status: open
scope: ["we:scripts/merge-ai-prs.mjs", "we:scripts/lane-drain.mjs"]
dateOpened: "2026-09-29"
tags: []
---

# Resolve-on-land misses items whose PR names the pre-number hash id

Twice on 2026-09-28/29 a delivered item stayed status active/open after its PR merged: #4391 (bornAs 4391, PR #2885 'WE #4391: …', flagged by the health daemon as stale-claim landed:4391) and #4464 (bornAs 4464, PR #2924 'WE #4464: …' — still open, and the builder's dry-run then planned to BUILD it again). Both PRs name the hash id; the drain JIT-numbers the card at land (commit 'drain: JIT-number 4464→#4464 …') and resolve-on-land looks for the number, not the bornAs. MVP: resolve-on-land in the drain (we:scripts/merge-ai-prs.mjs resolveOnLand step / we:scripts/lane-drain.mjs) matches a PR's delivered ref through bornAs as well as the number. Must: test with a hash-titled PR landing a JIT-numbered card; live proof: the next hash-titled delivery resolves on land.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

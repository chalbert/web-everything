---
bornAs: x832chf
kind: story
size: 3
parent: "2636"
status: open
blockedBy: ["2634"]
scope: ["we:scripts/pr-land.mjs", "we:scripts/lib/review-escalation.mjs"]
dateOpened: "2026-07-23"
tags: []
---

# Bind and reconcile the jury roster at PR-open against the real diff

At PR-open, recompute the jury roster from the **real diff** (`changedFiles`) and take the union with the pre-registered set from the charter — the predicted scope often misses an axis the actual diff touches (a "small script fix" that moves a UI file needs the a11y + visual jurors nobody picked). Selection is cheap (a scoring pass over the diff, the same `scoreEscalation` path in `we:scripts/lib/review-escalation.mjs`), so this re-pick costs almost nothing. Per the settled default, **roster expansion past what was pre-registered re-triggers human alignment** (not a silent rebind) and is flagged in the jury ledger. Wire into `we:scripts/pr-land.mjs` (the producer that already scores the rubric at open). Depends on the lens/method split.

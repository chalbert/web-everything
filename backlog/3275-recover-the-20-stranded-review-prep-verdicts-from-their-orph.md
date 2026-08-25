---
bornAs: xal2gqe
kind: story
size: 3
parent: "3029"
status: open
dateOpened: "2026-08-25"
tags: []
---

# Recover the 20 stranded review-prep verdicts from their orphan refs

Twenty-one lane/review-prep-* refs sit on origin with no PR of any state behind them, carrying finished independent-review verdicts for at least #2456, #2459, #2852, #2888, #2907 and #561. None of that text is on main. They are cloud-VM runs whose git push succeeded and whose PR-open could not, so the verdicts were never landed and nobody was told they existed. The reviews were real work and paid for; recovering them is replaying each ref's card diff onto a lane and landing it through the normal transport, after confirming the reviewed card has not moved underneath the verdict.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

---
kind: story
size: 3
parent: "2676"
status: open
dateOpened: "2026-07-27"
tags: []
---

# jury skill: red-team-after-jury + fail-closed

Update the jury skill so a positive jury verdict is followed by a mandatory adversarial RED-TEAM before ratification, and so any stage that returns an empty/failed result FAILS CLOSED (the harness must never let a foreman synthesize on an empty jury — that produced fabricated ratings this session).

Concrete edits to we:skills-src/jury + the we:scripts/lib/jury-core.mjs harness guidance.

Ratified in the feature-tracking-screen design session (committee → 10-juror jury → red-team → Round 2 → integration → frame committee → MASTER-DETAIL). Decision-view/trace artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d · Live integrated page: https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046

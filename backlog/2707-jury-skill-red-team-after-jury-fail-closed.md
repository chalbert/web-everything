---
bornAs: xkamotn
kind: story
size: 3
parent: "2676"
status: resolved
scope:
  - we:skills-src/jury/SKILL.md
  - we:skills-src/jury/subject-jury.workflow.js
  - we:scripts/lib/jury-core.mjs
  - we:scripts/lib/__tests__/jury-core.test.mjs
dateOpened: "2026-07-27"
dateStarted: "2026-07-27"
dateResolved: "2026-07-27"
tags: []
---

# jury skill: red-team-after-jury + fail-closed

Update the jury skill so a positive jury verdict is followed by a mandatory adversarial RED-TEAM before ratification, and so any stage that returns an empty/failed result FAILS CLOSED (the harness must never let a foreman synthesize on an empty jury — that produced fabricated ratings this session).

Concrete edits to we:skills-src/jury + the we:scripts/lib/jury-core.mjs harness guidance.

Ratified in the feature-tracking-screen design session (committee → 10-juror jury → red-team → Round 2 → integration → frame committee → MASTER-DETAIL). Decision-view/trace artifact: https://claude.ai/code/artifact/ba98baf4-3430-47bd-b90b-386be86d529d · Live integrated page: https://claude.ai/code/artifact/d6816fec-3b87-4480-9cbb-0bb96e05a046

## Progress

- **Engine (`we:scripts/lib/jury-core.mjs`)** — added the two pure red-team rules, the single source the harness
  enacts: `redTeamRequired(verdict)` (a red-team is owed exactly on `accept`) and `foldRedTeamVerdict({ran,
  findings})` (folds the red-team result fail-closed — an unrun red-team → `needs-human`, a break → `changes`, a
  clean run → `accept`; delegates to `deriveVerdict` with `humanRequired = !ran`).
- **Harness (`we:skills-src/jury/subject-jury.workflow.js`)** — added the mandatory post-jury RED-TEAM stage: on a
  jury `accept` (outcome land), one adversarial red-team agent runs before ratifying. Clean → land; broke the
  accept → `changes` folded into the same round loop (continue/escalate); did not run → degrades to `needs-human`
  (fail-closed backstop). Verdict + outcome come from the same shared review core the panel reduce uses; ledger
  gains the red-team's juror-running/finding/verdict events. Added a `Red-team` phase + RED_TEAM_SCHEMA + prompt.
- **Skill (`we:skills-src/jury/SKILL.md`)** — documented the red-team stage and the uniform fail-closed posture
  (resolve / mandatory lens / fold / red-team all degrade to needs-human on missing signal).
- **Tests (`we:scripts/lib/__tests__/jury-core.test.mjs`)** — 11 cases over `redTeamRequired` / `foldRedTeamVerdict`
  incl. the fail-closed guard and the negotiation-loop hand-off. Full suite green (272 tests); `check:standards` 0 errors.

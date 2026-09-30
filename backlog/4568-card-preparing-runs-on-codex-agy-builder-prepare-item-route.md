---
bornAs: xinccts
kind: story
size: 5
status: resolved
preparedDate: "2026-09-30"
scope: ["we:scripts/lib/provider-routing.mjs", "we:scripts/operations/probation-build-run.mjs", "we:scripts/operations/dispatch-lane-io.mjs", "we:skills-src/conveyor/prepare-item-agent-brief.md"]
dateOpened: "2026-09-29"
dateResolved: "2026-09-29"
tags: []
---

# Card preparing runs on Codex/agy: builder prepare-item route + standalone prepare mode

Operator decision 2026-09-29: card PREPARING runs on Codex/agy in the builder and standalone, while prepare-decision stays on Claude because it requires judgment. Prepared-card supply is the bottleneck; preparing on Claude costs Claude tokens, and Codex wrote correct Prep sections all evening. MVP: make prepare-item eligible for the prepare probation roster in we:scripts/lib/provider-routing.mjs, route builder prepares through the probation launcher in we:scripts/operations/dispatch-lane-io.mjs, and add standalone --taskType=prepare using we:skills-src/conveyor/prepare-item-agent-brief.md in we:scripts/operations/probation-build-run.mjs, with a card-only diff envelope, required preparation stamps, normal parked PR landing, and focused routing/envelope tests.

## Done when

1. Focused related Vitest tests pass for prepare routing, card-only edits, and unstamped refusal.

## Prep

### Design / MVP

- Route prepare-item to the prepare probation roster, Codex first; retain Claude Sonnet fallback.
- Keep prepare-decision on Claude for judgment.
- Run the existing prepare brief in standalone worker mode, with lifecycle owned by the runner.
- Permit only the target card body and preparedDate/preparedAgainstSha changes.
- Stamp and verify the result before the existing parked PR path; never resolve the prepared target.
- Test routing, card-only acceptance, code/frontmatter refusal, and missing stamps with related Vitest runs.

---
type: issue
workItem: story
size: 2
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: docs/agent/backlog-workflow.md (prepared-fork shape) + scripts/audit-backlog-health.mjs (G5 lint)
tags: []
---

# Force the fork-existence test at prep/DoR — per-fork justification before stamping preparedDate

The fork-existence test (backlog-workflow.md L264) is only skimmed at prep: #811's prep asserted Fork 1 = 'coherent, mutually-exclusive end-states… a real fork' with no justification of which branch is flawed or why they can't coexist, and a skeptic + the user caught it only at decision time. Sibling to #766 (red-team-the-default) but on the PREP path. Fix: every declared `## Fork N` must carry a one-line fork-existence justification — name the flawed/excluded branch, or why the coherent branches genuinely can't coexist — else dissolve to 'Supported by default' before stamping preparedDate. Edit the Fork-readiness pass (backlog-workflow.md) + the prepare-decision-item skill. Optional follow-on: a check-readiness lint flagging a prepared decision whose forks lack the justification line.

## Progress

Resolved 2026-06-16.
- **Fork-readiness pass / prepared-fork shape** (`docs/agent/backlog-workflow.md`): the `## Fork N` bullet now opens each fork with a one-line **fork-existence justification**, and a new bullet makes it a *prep-time* requirement (name the flawed/excluded branch, or why coherent branches can't coexist; else dissolve to "Supported by default" before stamping `preparedDate`). Cites the #811 miss.
- **Prepare skill** (`.claude/skills/prepare-decision-item/SKILL.md`): step 3 (author the prepared-fork shape) and the close-out gate (step 1) both require the justification line on every `## Fork N` before stamping.
- **Lint (the optional follow-on)** — implemented as `check:health` **G5** (`scripts/audit-backlog-health.mjs`), the natural sibling of G4 which already parses prepared-decision fork sections: flags a prepared, still-open decision with a `## Fork` carrying none of the fork-existence markers. CANDIDATE-class (wording may vary; confirm at claim). First run surfaced 3 real candidates (#428, #774, #775).

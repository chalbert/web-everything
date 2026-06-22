# Build-kind / exec vocabulary — which backlog kinds gate G2/G3 after the kind-axis migration

**Date**: 2026-06-22
**Point**: Prep research for decision #1473 — the backlog-health audit's exec gate hardcodes the
removed `idea|issue` kinds, so G2/G3 silently never fire; the canonical replacement (`kind !== 'decision'`)
already exists in proposer + rules-module + test, and the only live call is the epic-inclusion edge,
which the data settles toward *include epics*.
**Research page**: `/research/build-kind-exec-vocabulary/`
---

## Question

The audit's exec gate — which kinds gate G2 (built-ahead-of-ruling) and G3 (ungoverned-architecture) —
is `const isExec = it.type === 'idea' || it.type === 'issue'` (`we:scripts/audit-backlog-health.mjs:334`).
`idea`/`issue` were removed in the kind-axis migration (kinds are now story/decision/task/epic). So
`isExec` is always false and G2/G3 never fire. Which kinds are "exec/build" now?

## Recommendation

- **Fork 1 (forced invariant):** consume the canonical `isExecKind = (kind) => kind !== 'decision'`
  **imported** from `we:scripts/check-standards-rules.mjs:34` (single source already used by
  `we:scripts/readiness/proposer.mjs:38` `isBuildable` + `we:scripts/__tests__/exec-kind.test.mjs`).
  The broken branch — `idea`/`issue` — does not exist, so this is a ratify, not a fork.
- **Fork 2 (epic-inclusion edge):** **include epics** (all non-decision: story/task/epic). Excluding
  epics blinds G3 to 4 of 6 epic→entity graduations that no child carries.

## Key findings

- **The repair is not greenfield.** The canonical build-kind rule lives in three consistent homes:
  `we:scripts/readiness/proposer.mjs:38` (`isBuildable = it.kind !== 'decision'`),
  `we:scripts/check-standards-rules.mjs:34` (`isExecKind`), and `we:scripts/__tests__/exec-kind.test.mjs`
  (pins it). Only `we:scripts/audit-backlog-health.mjs:334` still uses dead vocabulary.
- **Non-decision complement, not an `idea|issue` list** — a positive enumeration drifts silently when
  the vocabulary changes (the bug here); `!== 'decision'` auto-covers a new build kind and its only
  failure vector (renaming `decision`) is test-pinned.
- **Epic edge, grounded:** 121 epics, 37 resolved+graduated, 6 graduate to a named standard entity.
  A skeptic argued "exclude epics, they double-count children." Tested against data: only **2 of 6**
  (#351↔#436, #618↔#629) are duplicated by a same-noun child; **4 are unique to the epic** (#049
  `block:component`, #468 `project:webblocks`, #570 `project:webcharts`, #1023 `project:webreporting`).
  Excluding epics loses 4 high-value signals to suppress 2 harmless duplicates (leaf still fires). The
  double-count is a *subject-dedup* concern (#1498's axis), not a kind-gate concern.
- **G2 is epic-safe regardless** — it guards `if (!isDecision(p)) continue`
  (`we:scripts/audit-backlog-health.mjs:356`).
- **Co-dependency:** the audit consumes neither helper today — G3 at
  `we:scripts/audit-backlog-health.mjs:366` does not call `isEntityGraduation` despite #1498's resolved
  "shipped" claim. Wiring `isExecKind` alone resurrects G3 at full volume; #1498's subject scope must
  land in the same change.

## Files Created/Modified

| File | Action |
|------|--------|
| `we:src/_data/researchTopics/build-kind-exec-vocabulary.json` | created — research registry entry |
| `we:src/_includes/research-descriptions/build-kind-exec-vocabulary.njk` | created — full write-up |
| `we:backlog/1473-audit-isexec-build-kind-vocabulary-which-kinds-gate-g2-g3-no.md` | rewritten to prepared-fork shape |
| `we:reports/2026-06-22-build-kind-exec-vocabulary.md` | this report |

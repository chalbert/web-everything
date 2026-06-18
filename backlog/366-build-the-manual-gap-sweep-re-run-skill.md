---
type: idea
workItem: story
size: 5
parent: "315"
status: resolved
dateOpened: "2026-06-12"
dateStarted: "2026-06-12"
dateResolved: "2026-06-12"
graduatedTo: .claude/skills/gap-sweep-rerun/
tags: [gap-analysis, competitive-analysis, repeatable, skill, tooling]
---

# Build the manual gap-sweep re-run skill

Build a manual /-skill that re-runs the competitive coverage gap sweep (corpus #316 -> extraction #346 -> mapping #347 -> gap->backlog #348) and reports the delta against the prior dated run. Decided in #349: ship manual-first, designed as a client of #192's freshness contract (dated-revision chain, lastSwept, idempotent dedup) rather than a parallel refresh engine. Idempotency is the acceptance test: a re-run over an unchanged landscape must open 0 new items and emit a no-op delta. Agent-ready — the four pipeline phases are resolved.

## Outcome (2026-06-12)

Delivered, agent-ready and idempotent. Three artifacts:

- **`we:scripts/gap-sweep-status.mjs`** — the helper (no data mutation): bare run prints corpus/capability/
  coverage status + runs an **invariant gate** (capability-id uniqueness, coverage ids resolve to
  capabilities or declare `capabilityRefs`, summary counts match, triage present); `--snapshot` writes a
  dated baseline under `reports/gap-sweep-snapshots/`; `--baseline=PATH` prints the delta (corpus ±,
  capabilities ±, re-kinded, fileable-gaps ±, newly-tracked) and reports **no-op = idempotent**.
- **`we:.claude/skills/gap-sweep-rerun/SKILL.md`** — the 7-step re-run procedure (snapshot → refresh corpus →
  re-extract → re-map + re-dedup → delta+gate → file NEW gaps only → stamp revision), encoding the #349
  contract (dated revisions, client-of-#192, idempotent).
- **`we:.claude/commands/gap-sweep.md`** — the `/gap-sweep` alias routing to the skill.

The invariant gate immediately earned its keep: it caught 4 coverage-gap ids that didn't match the
capability matrix (`notification-toast`→`toast`, `date-time-picker`→`date-picker`, `drawer-sheet`→`drawer`,
and `design-tokens-theming` as a synthetic gap now carrying `capabilityRefs`) — fixed. Verified: status +
snapshot + a no-op self-diff all green; `check:standards` green. Scheduled/automated version is #367.

**Graduated to** `.claude/skills/gap-sweep-rerun/` — gap-sweep-rerun skill + /gap-sweep command + we:scripts/gap-sweep-status.mjs.

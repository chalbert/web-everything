---
bornAs: x2c682x
kind: story
size: 5
parent: "3383"
status: open
blockedBy: ["3726"]
relatedTo: ["3804", "3797", "3772"]
scope: ["we:scripts/operations/turn-digest.mjs", "we:scripts/operations/turn-digest-io.mjs", "we:scripts/conveyor/poc-branch-sync.mjs"]
dateOpened: "2026-09-21"
tags: []
---

# Prototype sync alert: an ops-branch record, a digest line and a wip row (ruled in #3804 Fork 3)

Build the alert path for a stuck prototype sync: the sync pass commits a small record to an ops/ branch on state changes, and the every-turn digest and the wip report show the exact lines ruled in #3804 Fork 3, only when the operator must act, failing visible.

Carved from the ratified decision #3804 (Fork 3 and its record sub-fork; statute `we:docs/agent/platform-decisions.md#poc-branch-mechanical-sync`, point 3). The prototype's sync pass and the turn digest (#3724) live on the prototype branch, so this is built there.

## What to build

- **The record.** When a stuck-sync alert opens, changes state (`agent-failed`, `gate-red`) or clears, the sync pass commits one small file per branch to an `ops/` branch on origin (the repo already keeps `ops/pr-views` and `ops/review-requests`). It writes on a state change only, never on every tick or re-nag. If the push fails, it keeps a local copy and the surface shows the `unknown` line.
- **The surface.** A `needsOperator` row in the turn digest (`we:scripts/operations/turn-digest.mjs`, which already reports unreadable sources) and a row in the wip report's needs-you section. Raised only when the operator must act; nothing while the agent works; an unreadable record shows the `unknown` line, never "all clear".
- **The desktop notice stays** until #3726 delivers the digest into every session.
- **The wording is exact**, from the spec under #3804 Fork 3 ("The wording of (b)'s lines"): the three lines for `agent-failed`, `gate-red` and `unknown`, the `{age}` and `{reason}` forms, one line per stuck branch, one next step and a link per line, and no "all clear" message.

## Done when

1. **Executable** — the new test `we:scripts/operations/__tests__/prototype-sync-alert.test.mjs` passes under `npx vitest run`: it asserts the three exact lines for their states, that no line is produced when nothing is wrong, and that an unreadable record yields the `unknown` line.
2. A stuck-sync state written by the sync pass shows up as a row in the digest and in the wip report on a real run (screenshot or pasted output in the progress log).

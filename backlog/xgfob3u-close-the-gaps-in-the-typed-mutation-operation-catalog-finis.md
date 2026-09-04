---
kind: epic
parent: "3001"
status: open
dateOpened: "2026-09-04"
relatedTo: ["3001", "3029", "3273"]
relatedReport: reports/2026-08-08-agent-command-surface-sizing.md
tags: [operations, guard, agent-surface, catalog]
---

# Close the gaps in the typed mutation-operation catalog (finish the report's 7-family, ~28-operation catalog)

Follow-on build filed at `#3001`'s ratification (Fork 1: split by mutation, typed operations for anything that
mutates state outside the agent's own lane clone). The sizing report grouped observed mutations into **7
families and ~28 named operations** covering 95.3% of mutation volume, and found **roughly 83 raw
implementations already exist** (18 slash commands + 65 `we:scripts/*.mjs`) — this is "finish and close an
existing catalog," not "build one from scratch." Scoped to the **mutating** half only; reads stay free per
Fork 1. Coordinates with, not duplicates, `#3029`'s operation engine and `#3273`'s broader raw-call-site
census — this epic is the subset of that surface the guard decision specifically needs typed before
`#xtgier7` (the fail-closed guard flip, `blockedBy` this epic) can ship without breaking real workflows.

## Where the catalog actually stands today (checked against `we:scripts/operations/`, 2026-09-04)

Declared operations that exist: `claim`, `resolve`, `scaffold`, `verify`, `open-pr`, `dispatch-lane`,
`dispatch-abort`, `gap-sweep-status`, `review-pr`, `review-prep`, `stage-pr-view`, `record-verdict`,
`gate-health`, `pr-status`, `explore`, `mutation-check`, `suggest-next`, `wake`. Mapped against the report's
7 families:

| Family (report) | Typed today | Real gap |
| --- | --- | --- |
| Pull requests (`pr.*`) | `open-pr` (pr.open) | `pr.label`, `pr.comment`, `pr.merge`, `pr.close` still raw `gh pr …` |
| Build & verify | `verify` (gate.verify_lane / gate.check_standards) | `build.typecheck`, `build.run`, `deps.install` (`npm ci`) still raw |
| Outside world | `backlog.mutate` via `claim`/`resolve`/`scaffold` | `net.fetch` (`curl`), `proc.signal` (`kill`/`pkill`) have **no** operation at all |
| Lane lifecycle | none | `lane.create`/`lane.refresh`/`lane.discard` — `we:scripts/lane-pool.mjs` provisioning is still 35 raw call sites per `#3273`'s census |
| Committing | none | `lane.stage`/`lane.commit`/`lane.amend` still raw `git add`/`git commit` |
| Publishing | none | `lane.push`/`lane.rebase`/`lane.apply_patch` still raw `git push`/`rebase`/`merge`/`pull`/`stash` |
| Files | none | `file.write`/`file.delete`/`file.copy`/`file.move`, `dir.create`, `file.link` — the single largest family by observed mutation count (6,278) — have no typed operation at all |

**Files, Lane lifecycle, Committing and Publishing are the real gap** — four of seven families with zero
typed coverage today, together the majority of observed mutation volume. `pr.*` and `Build & verify` are
partially covered. `Outside world` is covered for `backlog.mutate` but bare for `net.fetch`/`proc.signal`.

## Scope

One operation per slice (mirrors `#3273`'s own "HOW to slice it" guidance: new files per operation, the two
shared registry/declared-homes files wired in a single follow-up slice per batch to avoid serializing the
whole epic on one file). Each slice: a declaration with **strictly typed parameters** (`#3001`'s Fork 1
sub-decision — no `run(script, args)` passthrough), an io module, tests, and a
`we:scripts/operations/declared-homes.mjs` entry. Not required to close every one of the ~28 named operations
before `#xtgier7` can start — see that item's own scope note on what "solid enough to flip" means; this
epic's job is to make that call possible, not to gate on literal 100% coverage of the tail (the report's own
90/95/99% coverage curve argues against chasing the last 1%).

## Done when

1. **Observable** — the four zero-coverage families above (Files, Lane lifecycle, Committing, Publishing)
   each have at least their highest-volume operation declared and wired into
   `we:scripts/operations/declared-homes.mjs` (`file.write`/`file.delete` for Files; `lane.create` for Lane
   lifecycle; `lane.commit` for Committing; `lane.push` for Publishing), and the partially-covered families
   (`pr.*`, Build & verify, `net.fetch`, `proc.signal`) close their remaining named gaps.
2. **Assertable** — the epic's closeout updates the table above against the real
   `we:scripts/operations/` state at that point, so `#xtgier7` can cite a concrete, checked "solid enough"
   rather than an assumption.

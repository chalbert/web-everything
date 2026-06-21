---
kind: story
size: 5
status: resolved
dateOpened: "2026-06-21"
dateStarted: "2026-06-21"
dateResolved: "2026-06-21"
graduatedTo: "we:src/_data/backlogMeta.js"
tags: [backlog-workflow, tooling, check-standards, dev-experience]
---

# Parked items must carry a strong machine-readable reason, surfaced as a pill

Today `status: parked` on a non-epic item (story/task) needs **no recorded reason** — only epics carry a `childlessReason` and oversized stories an `unsplittableReason`; a parked story can sit reason-less (e.g. #1083 was parked with only a prose "Blocked by #1082" note, no machine-readable edge). Make **every** parked item always carry a strong, machine-readable reason that renders as a pill on the /backlog/ tile, Prioritisation table, and detail page. Principle: parking is a deliberate hold and the WHY must be first-class and surfaced, never buried in prose.

## Scope

- **Vocabulary** — add a `parkedReason` controlled vocab in `we:src/_data/backlogMeta.js` (mirrors `childlessReasonMeta`), with at least: `blocked` (has a real `blockedBy` edge — already pills via `reasonPill`), `deferred` (deliberately held pending an external signal, e.g. funnel/usage data — #140 class), `external-infra` / `setup` (waiting on infra a person provisions), `superseded` (held pending a reframe). Each entry: label / bg / fg / tip.
- **Gate** — `we:scripts/check-standards-rules.mjs` errors when `status: parked` and no reason is derivable (no `blockedBy` edge AND no `humanGate` AND no `parkedReason`/`childlessReason`). "Parked with no reason" becomes a hard fail.
- **Render** — extend `reasonPill` in `we:src/_includes/backlog-badges.njk` to emit the `parkedReason` pill for parked non-epics (epics already render `childlessReason`); verify on /backlog/ (:8080).
- **Backfill** — the ~35 currently-parked items: give each a `parkedReason` (or convert a prose blocker to a real `blockedBy` edge). Includes #140 (`deferred` — funnel-data triage) and #1083 (now `blocked` via its #1391 edge).
- **Doc** — record the rule in `we:docs/agent/backlog-workflow.md` (parking requires a reason) and teach the `/park`/resolve tooling to demand it.

## Resolved (2026-06-21, batch-2026-06-21-1385-1392)

- **Vocabulary** — added `parkedReasonMeta` to `we:src/_data/backlogMeta.js` (mirrors `childlessReasonMeta`):
  `blocked` / `deferred` / `external-infra` / `superseded`, each with label / bg / fg / tip.
- **Gate** — `we:scripts/check-standards-rules.mjs`: `PARKED_REASONS` set + a rule in `validateBacklogItem`
  that **errors** when `status: parked` and no reason is derivable (no non-empty `blockedBy` edge AND no
  `humanGate` AND no `parkedReason` AND no `childlessReason`), plus an invalid-`parkedReason` check. "Parked
  with no reason" is now a hard fail.
- **Render** — extended `reasonPill` in `we:src/_includes/backlog-badges.njk` with a parked branch emitting a
  `⏸ <reason>` pill (styled from `parkedReasonMeta`). Wired `reasonPill` into the **tile** (`we:src/backlog.njk`
  card-grid badges) and the **detail page** (`we:src/backlog-pages.njk` header) — the two surfaces parked
  items actually render on (the Prioritisation table is actionable-only, so parked Tier-C items aren't in it
  by design). Verified on a clean 11ty build: 28 ⏸ parked pills on the tile + the styled tip/label, and the
  pill on the #890 detail page.
- **Backfill** — all 34 parked items now carry a derivable reason: ~6 already had a real `blockedBy` edge
  (pill "⊗ blocked by #N"); the remaining 28 got a `parkedReason` (`deferred` for the deliberate holds,
  `external-infra` for #890's unbuilt-vision-capability gate). Gate green (0 errors).
- **Doc** — recorded the parking-requires-a-reason rule in `we:docs/agent/backlog-workflow.md` (the
  parked-status lever). There is **no `/park` CLI verb** (`we:scripts/backlog.mjs` has claim/resolve/release/
  scaffold/settle, no park) in `we:scripts/backlog.mjs` — parking is a manual status edit, so the **gate is the enforcement** (no tooling
  to teach); the doc + the hard gate cover the demand.

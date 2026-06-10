---
type: idea
status: resolved
workItem: story
size: 5
dateOpened: "2026-06-09"
dateStarted: "2026-06-09"
dateResolved: "2026-06-09"
graduatedTo: none
tags: [backlog, tooling, determinism, dependency-graph]
---

# Lift backlog prerequisites from prose into a structured `blockedBy` edge

Today an item's prerequisites live only in prose ("blocked on…", "after #NNN",
"prerequisite") — 32 items express a dependency this way, and none in a
machine-readable field. That makes readiness **un-computable without an LLM**:
the dependency graph is trapped in sentences. Add a structured `blockedBy: [NNN]`
frontmatter edge so the backlog becomes a real DAG, which is the prerequisite for
any *deterministic* readiness scoring or fix algorithm (see #249, #250).

## Why a new field, not `crossRef`/`parent`

`crossRef` is a "see also" URL/label and `parent` is epic grouping — neither is a
directional *blocking* edge. A blocker is a distinct relation: "this cannot start
until NNN is `resolved`." It needs its own field.

## Build

- **Schema:** add optional `blockedBy: ["NNN", "NNN"]` (quoted, leading-zero-safe)
  to the content-item frontmatter in [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md)
  (*Adding an item*).
- **Loader:** parse it in [src/_data/backlog.js](src/_data/backlog.js) and expose a
  resolved `blockers` array on each item (the referenced item objects, so pages can
  link them).
- **Validator:** in the `check:standards` backlog rules, **error** if a `blockedBy`
  entry doesn't resolve to a real item id, points at itself, or forms a cycle
  (the readiness function in #249 assumes a DAG).
- **Migration:** convert the 32 prose-blocking items
  (`grep -liE "blocked on|prerequisite|after #?[0-9]{3}|depends on" backlog/*.md`)
  to declare their blocker as `blockedBy`, keeping a short prose note for humans.
  Splice each item's frontmatter — don't rewrite whole files.

## Acceptance criteria

- `blockedBy` documented in the frontmatter schema and parsed by the loader.
- `check:standards` rejects an unresolvable, self-referential, or cyclic `blockedBy`.
- The 32 prose-blocked items carry an explicit `blockedBy`, and `check:standards`
  stays green.
- A detail page shows its blockers as links.

## Outcome (resolved 2026-06-09)

- **Schema:** `blockedBy: ["NNN", …]` documented in [docs/agent/backlog-workflow.md](docs/agent/backlog-workflow.md)
  (*Authoring an item*), with a note on why it's distinct from `crossRef`/`parent`.
- **Loader:** [src/_data/backlog.js](src/_data/backlog.js) resolves the edge into a lightweight
  `blockers` array (`{ id, num, slug, title, status }`) for linking, dropping any NNN that doesn't
  resolve so a page never renders a dead link.
- **Validator:** `check:standards` (§6d-ter) errors on an unresolvable, self-referential, or cyclic
  `blockedBy` (DFS cycle walk) — verified by negative test.
- **Detail page:** [src/backlog-pages.njk](src/backlog-pages.njk) renders a *Blocked by* section
  linking each prerequisite with its status badge.
- **Migration scope — 23, not 32.** The `grep` heuristic in *Build* over-counts: it also catches soft
  sequencing ("after", "pairs with"), "benefits-from", open questions ("is it blocked on #140?"),
  prose describing what an item *unblocks* (not what blocks it), explicit "blocked-by nothing critical",
  and **non-item platform deps** (Template Instantiation / DOM Parts, the `DC-4` design concept) that
  have no NNN to point at. Migrating only the genuine hard "can't start until NNN resolved" edges gave
  **23** items — encoding the soft/non-item ones would corrupt the DAG signal #249's readiness scoring
  reads, so precision was chosen over hitting the estimate.

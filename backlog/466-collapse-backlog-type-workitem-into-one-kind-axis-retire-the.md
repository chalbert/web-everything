---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-13"
tags: [backlog, taxonomy, convention, type, workitem, tooling-refactor, design-decision]
---

# Collapse backlog type + workItem into one kind axis (retire the idea/issue distinction)

The backlog carries two near-redundant axes: `type` (idea/issue/decision) and `workItem` (story/epic/task). Tooling shows `type` is mostly cosmetic — readiness treats idea and issue identically (both Tier A), and the only load-bearing type is `decision`. `review` was just retired as a dead fourth type. So a buildable item is both `type:idea` and `workItem:story` — stating its nature twice. Decide: unify into one `kind` axis (story | epic | task | decision), dissolving idea/issue, or keep two axes and accept the redundancy. A real refactor across ~450 files + loader, readiness, validator, scaffold, render, and docs — decide deliberately, not by drift.

> Surfaced in a session that retired the dead `review` type (now idea/issue/decision only). This is **not prepared** — it captures the discussion as the plan of record; run `/prepare 466` to bring the fork to DoR before deciding.

## Evidence (why this is a real question)

- **`type` and `workItem` measure nearly the same thing.** A buildable item is `type: idea` **and**
  `workItem: story` — the nature ("a build") is stated twice.
- **Only `decision` is load-bearing.** Readiness tiering treats `idea` and `issue` **identically**
  ([backlog.js:176-180](src/_data/backlog.js#L176)) — both are Tier A. `decision` is the only type with
  distinct behavior (Tier B + the fork-shape validator [check-standards.mjs:291](scripts/check-standards.mjs#L291)).
  The validator does **not** even enum-check backlog `type` (only block types).
- **`idea` vs `issue` is cosmetic** — a badge colour + a filter order; the docs claim `issue › idea`
  ranks in selection but the tooling doesn't implement it (vestigial).
- **`review` just collapsed with zero residue** — a factual verification → `issue` (#033), an open
  judgment → `decision`. That it named no fourth nature is evidence the type axis is thin.

## Fork — unify vs keep two axes

- **A — unify into one `kind` axis: `story | epic | task | decision`.** `story/epic/task` keep the
  sizing semantics; `decision` keeps Tier-B + fork validation. `idea`/`issue` dissolve into
  `story`/`task`; "fix vs feature" becomes a tag if anyone wants it. One field, no redundancy; matches
  "a build is just a story." Cost: a migration across ~450 files + the loader, readiness, validator,
  scaffold, `/backlog/` render, and `backlog-workflow.md`, done in one pass.
- **B — keep two axes, accept the redundancy.** `type` = nature (idea/issue/decision), `workItem` =
  sizing. Zero migration; the cost is a permanent double-statement and a cosmetic idea/issue split. The
  status quo, minus `review`.

**Lean A** (one axis is the honest model), but the migration cost is real — this needs a deliberate
call, and `/prepare 466` should map the exact tooling/file touch-list before committing.

## Touch-list (for prep/build)

`backlog/*.md` frontmatter · `src/_data/backlog.js` (tiering) · `scripts/check-readiness.mjs` ·
`scripts/check-standards.mjs` (fork-shape check keys on `type === 'decision'`) ·
`scripts/backlog.mjs scaffold` (`--type`/`--workitem` flags) · `src/backlog.njk` + `src/backlog-pages.njk`
(badges, filters, `typeOrder`) · `docs/agent/backlog-workflow.md` (the normative enum + agile-sizing table).

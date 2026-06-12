---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-12"
tags: [research, freshness, versioning, staleness, design-decision, webdocs]
relatedProject: webdocs
crossRef: { url: /research/, label: "/research/ topic index" }
---

# Settle research-freshness foundation: history model, metadata home, staleness enforcement, scope

Carved off epic **#192** (longitudinal research freshness). The epic's three capabilities
— refresh-without-losing-history, freshness signals, new-axis discovery — can't be sliced
into batchable build stories while these forks sit unresolved in the epic body: a build
slice would bury a fork (you can't split away a decision). This item is the plan of record
for the **four coupled foundation forks**; resolving it unblocks #192's build slices. The
fifth fork (axis-discovery *trigger* — process vs automation) is genuinely open and stays
with the epic / its own decision; it does not gate the foundation.

Each fork already carries a stated lean (the **bold default** below). This is intended as a
near-ratification pass, not cold research — precedent: **#004** bundled OP-1+OP-11 into one
ruling.

## Why these four are one decision

They all land on the **same surfaces**, so they can't be settled independently without
churn: the research-topic registry [src/_data/researchTopics.json](src/_data/researchTopics.json)
(schema), the renders [src/research.njk](src/research.njk) and
[src/research-topic-pages.njk:41](src/research-topic-pages.njk#L41) (`Opened: {{ topic.dateOpened }}`),
and the validator [scripts/check-standards.mjs:82](scripts/check-standards.mjs#L82) /
[:156](scripts/check-standards.mjs#L156) (today only dup-checks the registry). None of
`lastReviewed` / `supersedes` / `reviewHorizon` exist in the tree yet — this decision defines
the schema they'll add.

## Forks

### OP-1 — History model
How does a re-researched topic supersede the old without destroying the dated trail?
- **Dated-report chain under one topic id, with a `supersedes` pointer (DEFAULT).** Refresh =
  a *new* dated `reports/YYYY-MM-DD-{topic}.md`, never an in-place overwrite; the topic
  surfaces the latest as canonical and links superseded revisions as history. Preserves the
  literal historical document (the audit value).
- Single living report with an in-file changelog. Lighter, but loses the original framing.

### OP-2 — Freshness-metadata home
Where do `lastReviewed` + `reviewHorizon`/volatility live?
- **`researchTopics.json` registry (DEFAULT).** It's the render source for `/research/`, so it
  naturally owns the surfaced date; one place to read for badges and the validator.
- Report frontmatter. Closer to the document but not the render source — forces a join.
- Both. Rejected unless a concrete need appears (two homes to keep in sync).

### OP-3 — Staleness enforcement
How is "overdue for review" made actionable?
- **Both a visible badge on `/research/` and a warn-only `check:standards` rule (DEFAULT).**
  Badge for readers, warning for maintainers; the warning slots beside the existing registry
  checks at [scripts/check-standards.mjs:156](scripts/check-standards.mjs#L156). Never an error
  (stale research is a nudge, not a build break).
- Badge only / warning only — each misses one of the two audiences.

### OP-4 — Scope of "research" freshness
What does freshness apply to?
- **Promoted `/research/` topics only (DEFAULT).** The registry is the unit; ad-hoc
  `reports/*.md` (including backlog-mirrored pointer reports) stay frozen by design — they're
  point-in-time session artifacts, not living surveys.
- Every `reports/*.md`. Broader, but most reports are not meant to be re-evaluated and have no
  registry entry to hang a date on.

## What ratifying this unblocks (build slices, authored after the ruling)

- **A — foundation:** add `lastReviewed` + revision-chain fields to the registry schema; render
  "current + history" and a freshness badge scaffold on `/research/`. (size ~3)
- **B — staleness:** derive stale state from age/horizon; add the `check:standards` warning.
  (~2, blocked-by A)
- **C — history/supersedes:** refresh = new dated report + `supersedes` pointer; render prior
  revisions. (~3, blocked-by A)

D (axis-discovery sweep) is separate — gated on the open trigger fork, not this item.

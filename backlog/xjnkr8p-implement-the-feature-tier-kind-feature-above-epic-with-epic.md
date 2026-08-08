---
kind: story
size: 8
parent: "2705"
status: open
dateOpened: "2026-08-08"
tags: [backlog, taxonomy, data-model, hierarchy, tooling]
---

# Implement the feature tier: kind:feature above epic, with epic-parity plumbing and the flat/root gates

Build what #2691 ratified. Add feature to BACKLOG_KINDS and the we:scripts/backlog.mjs --kind guards; cover it in every kind-filter list in we:src/backlog.njk (the section-10 drift guard, or feature items render invisible); give feature epic-parity at the kind-keyed loader sites in we:src/_data/backlog.js so it is a grouping tier, not Tier-A buildable work; generalize feature-child status coherence and the parent-deadlock guard in we:scripts/check-standards.mjs; and add the two invariants — a feature has no kind:feature ancestor (flat) and no parent at all (top-tier root). Then wire the featureOf rollup consumer in plateau-app:src/backlog-view/ so #2733 can re-baseline the screen.

The ruling is the statute rule [we:docs/agent/backlog-workflow.md#feature-tier](../docs/agent/backlog-workflow.md#feature-tier)
— cite the anchor, not the deliberation. This story is the *plumbing tax* that ruling names explicitly:
`feature` is a **grouping tier like `epic`, not buildable work**, so miss one `kind`-keyed site and a
feature either mis-renders as agent-ready or vanishes from its lane (the `type: review` #602/#610
failure mode). Nothing here is a fresh design call.

## Scope — the six additions

1. **Kind vocabulary.** `BACKLOG_KINDS` (`we:scripts/check-standards-rules.mjs:40`) gains `feature`;
   the `--kind` guards (`we:scripts/backlog.mjs:524,681`) accept it.
2. **Kind-drift guard §10** (`we:scripts/check-standards.mjs:1488`) — add `feature` to **every**
   kind-filter list in `we:src/backlog.njk` (both facets). The gate fails until the template covers it;
   that is the point.
3. **Grouping-tier parity (the epic analogue).** Fix `deriveTier` (`we:src/_data/backlog.js:186`) so an
   open `kind: feature` is **not** Tier-A, and give `feature` epic-parity at the `kind === 'epic'`
   grouping sites (`we:src/_data/backlog.js:75` scope-pill, `:476`, `:524` sliceable, `:870` board bucket).
4. **Feature↔child coherence** — generalize the epic↔child status blocks
   (`we:scripts/check-standards.mjs:833`, `:863`) so a `resolved` feature with an open epic child is flagged.
5. **Parent-deadlock guard** (`we:scripts/check-standards.mjs:794`) — extend the `kind === 'epic'` scope
   to `feature`, so a child cannot list its own feature parent in `blockedBy`.
6. **Flat + top-tier invariants** — no `kind: feature` ancestor over a feature (flat), and a
   `kind: feature` carries **no `parent` at all** (root). Enforce the root form directly, *not* a
   `{story,epic,task}` blacklist — that leaks via `feature → decision → epic`, passes a dangling parent,
   and is itself a §10-style drift footgun.

Plus the rollup consumer: `featureOf(epic)` = nearest `kind: feature` ancestor along `parent`, else
`null` ⇒ the **Unassigned** bucket (`plateau-app:src/backlog-view/`), which is what #2733 re-baselines.

## Done when

- `npm run check:standards` green with `feature` in the vocabulary, and a deliberately-malformed
  fixture (a feature with a `parent`, and a feature under a feature) **errors** on both invariants.
- A real `kind: feature` item renders on `/backlog/` under both facets and does **not** appear in
  `check:readiness -- --select` Tier A.
- The rollup groups epics by nearest feature ancestor, with feature-less epics in Unassigned.

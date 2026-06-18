---
type: issue
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: docs/agent/platform-decisions.md
relatedReport: audits/2026-06-18-decision-codification-register.md
tags: [governance, decisions, codification, docs]
---

# Establish the platform-decisions statute layer + `codifiedIn` discipline + G6 gate

A 2026-06-18 sweep of all 166 resolved `type: decision` items (the `decision-codification-sweep`
workflow — statute-digest → batch-classify → adversarial-verify → synthesize, 115 agents) found
**64% were "case-law-only"**: the ruling lived only in its backlog file, so each new placement /
naming / monetization / boundary question re-derived the same axis instead of citing it. Eight
recurring-axis clusters accounted for the bulk of the re-litigation (constellation placement alone =
10 decisions). Full per-decision status: `we:audits/2026-06-18-decision-codification-register.md`.

This item establishes the fix — a **statute layer** distinct from the case-law chain, plus a
promotion discipline so the chain can't silently become the only home of the platform's rules again:

- **`we:docs/agent/platform-decisions.md`** — new source-of-truth doc stating the 8 cluster rules as
  *named, citable* rulings (constellation placement, WE↔FUI embed boundary, Project/Protocol bar,
  intents-UX-only, monetization *(soft)*, no-leakage Plateau client, tagName naming, Guard/Gate,
  `<component>` DC table), each with its lineage `#NNN` list. Routed from `we:AGENTS.md` "Where to
  look" and cross-linked from `we:design-first.md`.
- **`codifiedIn:` frontmatter** on `type: decision` items — points at the guideline path carrying
  the rule, or the sentinel `one-off` (analogue of `graduatedTo: none`). Backfilled on the 65
  clustered decisions.
- **`check:health` flag G6** (`we:scripts/audit-backlog-health.mjs`) — a candidate pool (not a hard
  gate) surfacing every resolved decision still missing `codifiedIn`. At resolution: 95 remaining —
  the uncodified backlog, which should shrink, never grow.
- **Promote-on-ratify instruction** in `we:AGENTS.md` (Definition of Done) and
  `we:docs/agent/backlog-workflow.md` (the resolve step): when a ratified decision establishes a
  reusable rule, promote the rule into the statute layer and set `codifiedIn`; the decision keeps
  the lineage, the guideline carries the rule. Rules stay reversible (supersede with lineage).

**Follow-up (tracked by the gate, not a single item):** the 95 G6 candidates are promoted-or-marked
incrementally as decisions are next touched; high-leverage ones (19 flagged `loadBearing:high` in
the register) first. No new item needed — G6 is the running tracker.

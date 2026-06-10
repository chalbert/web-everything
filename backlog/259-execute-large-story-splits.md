---
type: decision
workItem: story
size: 3
status: open
dateOpened: "2026-06-10"
tags: [backlog, split, agile-sizing, batchable, decision]
relatedReport: reports/2026-06-10-backlog-split-analysis.md
---

# Execute the large-story splits from the 2026-06-10 split analysis

The `/split` dry run (2026-06-10) analysed all 9 open `story` items of `size` > 5 against the split-safety rubric and found **6 splittable, 3 not** (full report in `relatedReport`). This item tracks acting on it: perform the safe splits and register the blocked ones as decisions. Each split mutates the backlog (convert original → storied epic / scaffold slices / set edges, gated on `check:standards`) and needs a go, so they're staged here rather than auto-applied.

## Splits to execute (ranked by leverage)

1. **#228** — clean: root construction fix `story·3` + 3 independent lifecycle `task`s (disconnect / attribute-changed / form-associated). Pure win; only #167 carries over.
2. **#005** — clean: capability-manifest schema `story·3` + consumer slices. Slice A also **re-points #085's blocker** to the narrower prerequisite.
3. **#085** — clean fan-out: intent registry + per-adapter slices; slices inherit the #004/#005 blockers (do after #005-A).
4. **#081** — close-out, not epic conversion: v1 + phases 2a/2b/2c are shipped, so **resolve #081** (`--graduated-to=module-service`) and spin out its 4 non-blocking follow-ons.
5. **#086 / #100** — staging splits: slices shrink but stay ≈`5`; lower urgency.

## Could-not-split → register as Tier-B decisions

- **#092** — decide the ingestion model (build-time export vs runtime agent vs both).
- **#093** — run the design/exploration pass it asks for (home / proof format / enforcement seam).
- **#191** — waits on #005's descriptor format; revisit split after #005's manifest slice lands.

## Acceptance

- The 6 splittable items are split (or explicitly deferred with a reason), each leaving `check:standards` green.
- The 3 could-not-split forks are captured as `type: decision` items so they surface in decision-mode selection.

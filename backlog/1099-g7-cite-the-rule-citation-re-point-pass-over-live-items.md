---
type: idea
workItem: story
size: 3
status: resolved
dateOpened: "2026-06-19"
dateStarted: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# G7 cite-the-rule citation re-point pass over live items

Re-point the live (non-resolved) items that `check:health` flag G7 lists: where an item cites a codified decision by `#N` as current guidance, swap the bare `#N` for a link to its statute anchor so the rule propagates, not the case number. Run SOLO (no concurrent batch) — the bulk edits race the shared git index. A careful, mostly-KEEP pass: most flags are genuine lineage and stay.

## What to do

Run a per-item agent workflow (one agent per G7 item, surgical Edit-tool changes), as proven in the #911 remediation. For each cited `#N`:

- **Re-point** when the prose leans on the decision as *current guidance* — replace `#N` with `[<rule name>](docs/agent/platform-decisions.md#<anchor>)`.
- **Keep `#N`** for genuine lineage ("supersedes #N"), structural sibling/child item links, and non-citation number matches ("primitive #4"). A trial run found only ~half the flags are real re-points.

## Preconditions

1. Anchors must be verified-correct first — **done** in #911 (all 132 `codifiedIn` resolve, 0 dangling).
2. **Run solo, no concurrent batch/session** — another session's `git add -A` swept/scattered the edits repeatedly in the first attempt; that race is the only reason this was deferred.

**Success:** G7 drops to its irreducible lineage floor; `check:health` G7 tracks the candidate pool. Origin #911; mechanism in `we:scripts/audit-backlog-health.mjs` (G7, live-scoped).

## Outcome (2026-06-19)

Pass complete: **75 → 71** flagged live items. Re-pointed the four where the prose invokes a *generic
standing rule* as current authoring guidance for that item's own work — swapping the bare `#N` for a
`[<rule>](docs/agent/platform-decisions.md#<anchor>)` link (the anchor clears every flag sharing it):

- **#638** — "Reflects the #606 ruling that plugs is implementation owned by FUI…" → `#constellation-placement`.
- **#640** — "violating the #606 invariant that real apps use the unplugged surface" → `#constellation-placement`.
- **#1001** — "the WE→FUI move governed by #170 / #449 / #606 (plugs = FUI-owned…)" → `#constellation-placement`.
- **#966** — "WE = contracts + conformance only" (#855 B2), no-leakage client (#475), and the monetization
  ranking (#089-#093) → `#constellation-placement`, `#no-leakage-client`, `#monetization`.

The remaining **71 are the irreducible lineage floor** (confirmed by per-ref context read): they cite a
specific *case* for its specific holding (e.g. "the dev browser (#141)", "from the #488 ruling", "Design
lineage: #014 / #467 / #508"), or are structural blocked/child/slice/split/sibling links, or
case-narration ("#N ruled X"). Re-pointing those to a generic anchor would *lose* the case-specific
information — citing the case is correct there. G7 now tracks this candidate pool as designed.

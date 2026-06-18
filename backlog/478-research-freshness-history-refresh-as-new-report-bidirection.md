---
type: issue
workItem: story
size: 3
parent: "192"
status: resolved
blockedBy: ["476"]
dateOpened: "2026-06-13"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: []
---

# Research-freshness history: refresh-as-new-report + bidirectional supersedes render

Slice C of the research-freshness ruling (#441), blocked by #476. Implement refresh = a new dated reports/YYYY-MM-DD-{slug}.md (never in-place overwrite); the topic surfaces the latest as canonical and links superseded revisions via the bidirectional supersedes/supersededBy pointer + superseded status. Render prior revisions as history on the topic page (we:src/research-topic-pages.njk). Preserves the immutable dated audit trail #192 names.

## Progress (2026-06-13) — resolved

Built on #476's schema + `revisionHistory` macro (the bidirectional chain render already shipped there). This slice adds the three pieces that make a refresh *behave*:

- **Latest-as-canonical grid** — [we:src/research.njk](../src/research.njk): the Open Research Topics grid skips `status: superseded` entries, so a refresh's new entry is the card and the old revision is demoted (still reachable by its permalink + the canonical's history chain).
- **Superseded banner** — [we:src/research-topic-pages.njk](../src/research-topic-pages.njk): a reader landing on an old revision gets an up-front "Superseded revision" banner linking the current version (the `supersededBy` target), above the existing revision-history card.
- **Authoring convention** — [we:docs/agent/research-workflow.md](../docs/agent/research-workflow.md): a "Refreshing a topic" section codifies refresh-as-new-report — new dated `reports/YYYY-MM-DD-{slug}.md` + new registry entry with `supersedes`, old entry flipped to `superseded` + back-pointer `supersededBy` (bidirectional, gate-validated). Never an in-place overwrite — the immutable dated audit trail #192 names.

**Verified** with an isolated, reverted fixture build (temporarily marked an existing topic superseded → rebuilt to a throwaway dir): superseded topic absent from the grid (0), banner + canonical link render, both history directions render ("Supersedes:" / "Superseded by:"), canonical stays on the grid; data file restored clean. Gate green (after a pre-existing we:AGENTS.md inventory count refresh, left unstaged as unrelated). No data fabricated — the mechanism ships ready for the first real refresh.

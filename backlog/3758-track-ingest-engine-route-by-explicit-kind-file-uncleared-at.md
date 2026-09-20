---
bornAs: xa5m4cy
kind: story
size: 5
parent: "3740"
status: open
blockedBy: ["3746", "3753", "3757"]
scope: ["we:scripts/operations/track.mjs", "we:scripts/operations/track-io.mjs", "we:scripts/operations/run.mjs", "we:scripts/operations/__tests__/track.test.mjs", "we:skills-src/track/SKILL.md"]
dateOpened: "2026-09-20"
tags: []
---

# track ingest engine: route by explicit kind, file uncleared, atomic and resumable batch

Adds the write mode to the track operation, independent of any one source. It routes each valid line by its declared kind (fix and build and decide to file-item, note to append-note referencing card ids only), defaults a missing or ambiguous kind to a card and flags it, uses capability-search only to warn and link and never to drop a line, and files the whole batch into one working tree so one run makes one pull request. A retry after a crash files nothing twice. Design-first, uncleared.

Slice of epic #3740 (design points 1, 3 and the routing half of 4). The epic's own slice list had no home for this core, which is why it is added here (see the split report in the pull request). Filed uncleared: a design review comes before any build.

## Design

**Settled (read from the code).**

- The write mode is a declared operation, `track` (`we:scripts/operations/track.mjs`, pure, plus `we:scripts/operations/track-io.mjs`, the only place that touches fs), built on the read-only slice's reconcile core and registered in `OPERATIONS` (`we:scripts/operations/run.mjs:97`). It follows the file-item shape: an injected reader (`we:scripts/operations/file-item.mjs:116`), a `plan` compute step, then effect steps. It reads sources through per-source adapters that later slices add; this slice proves the engine on fixture sources.
- Routing is by the declared kind and never inferred. A `story` cannot be filed without a size (`story-needs-size`, `we:scripts/operations/scaffold.mjs:130`), and sizing is judgment a batch cannot do, so the engine files `fix` and `build` lines as `task` and `decide` lines as `decision`; sizing and slicing are decided at design review. `note` lines go to `append-note`.
- A missing, unknown or ambiguous kind defaults to a card (`task`) and is flagged in the report. Over-filing is cheaper than losing work.
- Every card is filed with `--queue=false`, with `provenance` from the line contract and `intakeKey` from it, so nothing the engine files is visible to the conveyor. The guard in the file-item slice is the backstop.
- Duplicate detection warns and links, it never drops. `searchCapabilities` (`we:scripts/capability-search.mjs:227`) is already exported and is called for each line; a partial or exact hit is written into the new card body as a possible-duplicate link and into the report. The line is filed regardless.
- The batch is pre-flighted (line contract, secret scan over every line) before any card is written, so a bad line fails the whole batch with nothing on disk. Resume is by key: cards filed before a crash are found by the reconcile core on retry and skipped, so a retry files nothing twice. All cards of a run go into one lane tree, so one run is one pull request.
- The engine runs only in a lane clone. The card writer already refuses the primary checkout (`we:scripts/backlog/guarded-write.mjs:55`), so no new guard is needed.

**Open (settle in the design review).**

1. A `note` line has to reference card ids and may not carry an owed list. A note line with no card id: default it to a card (consistent with the missing-kind rule) or reject it. Leaning default-to-card.
2. `build` as a `task`: is a bare task the right container for buildable work, or should a line be allowed to carry a size hint so it can be filed as a story? Leaning task, with sizing at review.
3. Where the run ends. `file-item` stops after the write and a person or driver runs `verify` then `open-pr`. Should `track` include commit, `verify` and `open-pr` as declared steps to make "one run, one pull request" a single command, or hand off exactly as `file-item` does?
4. Calling `file-item`: import its declaration and run it in process, or shell the `file-item` command of `we:scripts/operations/run.mjs` per card. In process keeps the pre-flight atomic and testable; a shell-out keeps the single declared home literal.
5. Who acquires the lane clone for a run (the engine, the caller, or the conveyor).

## Done when

1. **Executable** — `node --test we:scripts/operations/__tests__/track.test.mjs` passes. Against a fixture repo and fixture sources with four valid lines (one each of fix, build, decide and a note that cites a card id) it files two tasks and one decision, appends one note, and every filed card carries `intakeKey` and `provenance` in its frontmatter.
2. **Executable** — the same suite proves nothing is cleared: after the run the fixture queue sidecar is byte-identical, and `planTick` (`we:scripts/conveyor/tick-core.mjs:1010`) fed the state read from it has no build spawn for any filed card.
3. **Executable** — the same suite proves idempotency and atomicity: a second run over the same sources files nothing; a batch where the third of four lines carries a secret-shaped value writes zero cards; a line with no kind is filed as a task with the flag in the report; and a line that nearly duplicates an existing card is still filed, with a possible-duplicate link in its body.

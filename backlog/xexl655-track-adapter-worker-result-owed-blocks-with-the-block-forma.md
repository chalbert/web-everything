---
kind: story
size: 5
parent: "3740"
status: open
blockedBy: ["xa5m4cy", "x6549sd", "xkbcdq0"]
scope: ["we:scripts/operations/track-source-owed.mjs", "we:scripts/operations/__tests__/track-source-owed.test.mjs", "we:skills-src/conveyor/delivery-agent-brief.md", "we:skills-src/conveyor/delivery-agent-brief-v2.md"]
dateOpened: "2026-09-20"
tags: []
---

# track adapter: worker result Owed blocks, with the block format and a soft-first warn

Defines the Owed block a worker writes at the end of its result file (one line per owed item: kind, summary, reference), teaches the delivery briefs to write it, and adds the adapter that reads result files under the operations jobs directory and hands the lines to the ingest engine. Starts soft: a missing or malformed block warns and is counted, it does not fail the run. Design-first, uncleared.

Slice of epic #3740 (design points 5 and 6, the worker source). Filed uncleared: a design review comes before any build. It carries the per-source table row for this source: trigger is the end of a worker job, input is the `## Owed` block of a result file, enforcement starts soft.

## Design

**Settled (read from the code and the files on disk, 2026-09-20).**

- There is no parseable format today. Worker result files live outside the repository, under the operations jobs directory of the workspace, 58 of them, and only 7 have any heading that names owed work at all. So this slice has to define the block and teach the writers, not just read an existing one.
- The block is a `## Owed` heading followed by lines in the line contract's form (`we:scripts/lib/track-line.mjs`, the contract slice): kind, one-line summary, reference. Nothing else in a result file is read.
- Every card from this source carries provenance `worker`, so it is filed uncleared and cannot be cleared by the file-item guard.
- Enforcement starts soft: a missing block, or a malformed line, is a warning that is counted, and it does not fail the run. Valid lines in the same block are still ingested. The secret pre-flight is not soft: one secret-shaped line fails the whole batch from day one, as the epic requires.
- The adapter is its own module and reads through the engine's source seam; it owns its parsing and nothing else. Provenance and the key come from the line contract, and the result-file path is what makes it a `worker` source.
- The writers are taught through the delivery briefs (`we:skills-src/conveyor/delivery-agent-brief.md` and `we:skills-src/conveyor/delivery-agent-brief-v2.md`), which is how conveyor delivery agents learn what their result must contain.

**Open (settle in the design review).**

1. Hand-dispatched workers. Jobs like the one that wrote this card are dispatched from a task file outside the repository, so a brief edit does not reach them. Options: a snippet the orchestrator pastes into every task file, a template file kept in source, or leaving hand-dispatched jobs to the backfill and the reconcile check.
2. An explicit `none` line for a job with nothing owed, so a missing block (a writer who forgot) is distinguishable from an empty one (a writer who checked). Leaning yes.
3. The home of the warning counter that the hardening decision measures. The wip display of it belongs to card 3736, whose report code lives on the dispatcher branch, not on main; this slice must expose the count from a place either can read.
4. How the engine finds the adapter: an explicit registry line in a shared file, or directory discovery. Discovery keeps sibling adapters scope-disjoint; if the registry stays explicit, the engine's io file joins this slice's scope.

## Done when

1. **Executable** — `node --test we:scripts/operations/__tests__/track-source-owed.test.mjs` passes against fixture result files: a well-formed three-line block yields three intake lines with provenance `worker`; a file with no block yields no lines, one counted warning and no failure; a malformed line inside a block is warned and counted while its valid neighbours are still yielded.
2. **Executable** — the same suite proves the hard parts: a block with one secret-shaped line fails the whole batch and yields zero lines to write, and two runs over the same fixture yield the same keys so the engine files nothing the second time.
3. **Executable** — the same suite asserts that both delivery briefs contain the `## Owed` instruction, so a brief edit cannot silently drop it.

---
bornAs: xrckwkk
kind: story
size: 5
parent: "3740"
status: open
blockedBy: ["3760", "3759", "3761"]
scope: ["we:scripts/operations/track-backfill.mjs", "we:scripts/operations/__tests__/track-backfill.test.mjs", "we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md"]
dateOpened: "2026-09-20"
tags: []
---

# track backfill: one-time sweep of the current handoff, tracker owed lists and unread result files

The first run of the track operation over the work that has already leaked: the current handoff, the owed lists inside the epic 3383 tracker notes, and every result file not yet read. It produces a review report of the proposed uncleared cards, waits for the operator to confirm, then ingests them and rewrites the tracker owed lists into card ids. Runs once; a second run must file nothing. Design-first, uncleared.

Slice of epic #3740 (design point 5, the one-time first run). Filed uncleared: a design review comes before any build. It cannot be the first thing built, whatever the epic's wording ("the first step") suggests: it runs the ingest engine and the adapters, so it comes after them. "First" describes the first run of the finished tool.

## Design

**Settled (read from the files, 2026-09-20).**

- Three input sets: the current handoff file, the owed lists inside the session-update notes of the epic 3383 tracker card (`we:backlog/3383-a-background-mechanical-dispatcher-replaces-the-interactive.md`, about 3000 lines), and the worker result files that have not been read.
- These are free text: none of them has an `## Owed` block or a line contract. Turning them into contract lines is judgment, so the sweep is propose, review, confirm, ingest. A model proposes lines in the contract form and the script does everything after that (contract validation, secret pre-flight, engine). Nothing is filed before the operator confirms the review report.
- Every card is filed uncleared, with the provenance of its real source path, through the same engine as every other run. The backfill has no privileged path.
- It runs once as a sweep, but its safety is the engine's idempotency, not a promise that it will not be run twice.

**Open (settle in the design review).**

1. Key stability for model-proposed lines. The engine keys a line by source file plus a hash of its text, but a second extraction pass can word the same owed item differently and mint a new key, filing a duplicate. Options: key the backfill by the source span it was extracted from (path plus line range), or record the confirmed proposal file and re-run from it rather than re-extracting. Leaning the recorded proposal, since the operator confirmed exactly those lines.
2. "Unread" result files. No read marker exists, so "unread" cannot be computed. Options: treat all 58 as unread and lean on idempotency and the review report, or add a marker. Leaning all of them, once, since the review report is where the operator prunes.
3. The tracker: rewrite each owed list in place into card ids (edits history), or leave the old notes and append one note that points at the cards, which stays append-only and passes the append-note lint. Leaning the pointer note.
4. Size of the review. If the sweep proposes dozens of cards, one review report is too large to read; group by source and confirm per group.

## Done when

1. **Executable** — `node --test we:scripts/operations/__tests__/track-backfill.test.mjs` passes against a fixture handoff, a fixture tracker with two prose owed lists, and three fixture result files: the propose step writes a review report listing the proposed cards and files none.
2. **Executable** — the same suite proves confirm then ingest: after confirmation every proposed card exists, uncleared, with the provenance of its source path; the read-only check over the same fixtures then reports nothing unmatched.
3. **Executable** — the same suite proves the second run: run again over the same fixtures, it files nothing, and the tracker fixture holds exactly one pointer note.

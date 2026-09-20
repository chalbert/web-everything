---
bornAs: xv9vans
kind: story
size: 5
parent: "3740"
status: open
blockedBy: ["3746", "3753"]
scope: ["we:scripts/track-check.mjs", "we:scripts/lib/track-reconcile.mjs", "we:scripts/__tests__/track-reconcile.test.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# track --check: a read-only reconciler that reports every owed line with no card

The read-only half of track: a plain script over a pure reconcile core. It reads the intake sources, parses each line with the line contract, and reports which lines have a card (matched by the intake key on the card), which have none, which are ambiguous, and which are malformed. It writes nothing, so it is safe to run at any time, and it exits non-zero when anything is unreconciled so it can gate. Design-first, uncleared.

Slice of epic #3740 (the read-only reconciler). Filed uncleared: a design review comes before any build.

## Design

**Settled (read from the code).**

- Reads stay free, mutating work is declared. `we:scripts/capability-search.mjs` states the split in its own header (#3001: a read is a plain script any session runs directly, not an `op()` declaration). So the check is a plain script, `we:scripts/track-check.mjs`, over a pure core, `we:scripts/lib/track-reconcile.mjs`. The ingest engine slice later builds the declared `track` operation on the same core, so the read and the write can never disagree about what "has a card" means. This is a re-cut of the epic's wording ("a read-only reconciler `track --check`"), which reads as a mode of one operation.
- Matching is by intake key. The core collects every card's `intakeKey` (written by the file-item slice) through the same loader idiom the search script already uses (`derive` from `we:src/_data/backlog.js`, `we:scripts/capability-search.mjs:170`), then classifies each parsed source line as one of: matched, unmatched, ambiguous (two cards carry one key), or malformed (fails the line contract).
- No new secret or provenance logic: parsing and validation are imported from the line contract (`we:scripts/lib/track-line.mjs`), never copied.
- It writes nothing: no card, no source file, no ledger. The pure core has no fs; only the script shell reads.
- The sources are a seam the script is handed. This slice proves it against fixture sources; each real source arrives with its adapter slice.

**Open (settle in the design review).**

1. Usefulness before any adapter exists. With no real source reader yet, this slice proves the matching, the report shape and the exit code on fixtures only; the operator's first real "size of the leak" number arrives with the first adapter. Alternative: fold the worker-result reader into this slice and take it to size 8, which breaks the size rule. Leaning to keep it small and accept the delay.
2. Cards in a pull request that has not landed. The working tree may not hold them yet, so their lines would show as unmatched. The landing slice owns the pending-intake ledger that closes this; until then the report must label the gap, not hide it.
3. Report shape and exit codes: one line per source line versus per-source counts by default, and whether an ambiguous match is a failure or a warning (leaning failure, since two cards for one key means a past duplicate).

## Done when

1. **Executable** — `node --test we:scripts/__tests__/track-reconcile.test.mjs` passes with fixture sources and cards covering all four classes: a line whose key is on a card is matched, a line with no card is unmatched, a key on two cards is ambiguous, and a line that fails the line contract is malformed.
2. **Executable** — the same suite proves it writes nothing: the fixture directory tree is byte-identical before and after a run.
3. **Executable** — `node we:scripts/track-check.mjs --fixture=<dir>` exits 1 when the fixture holds an unmatched line and exits 0 when every line is matched.

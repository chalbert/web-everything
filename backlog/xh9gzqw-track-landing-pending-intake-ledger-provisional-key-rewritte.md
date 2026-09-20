---
kind: story
size: 5
parent: "3740"
status: open
blockedBy: ["xa5m4cy"]
scope: ["we:scripts/operations/track-ledger.mjs", "we:scripts/operations/track-io.mjs", "we:scripts/operations/__tests__/track-ledger.test.mjs"]
dateOpened: "2026-09-20"
tags: []
---

# track landing: pending-intake ledger, provisional key rewritten to the number at land, id written back to the source

Ids are assigned by the drain at land, so until the pull request lands every filed card has only a hash id. This slice keeps a pending-intake ledger that survives until the pull request lands, keeps hash ids in the sources meanwhile, rewrites them to real numbers once the drain has numbered them, and writes the card id back into the source line so a re-run finds it. States the merge strategy for concurrent runs on the shared tracker tail. Design-first, uncleared.

Slice of epic #3740 (design point 4, ids at land, plus the merge strategy from point 3). Filed uncleared: a design review comes before any build.

## Design

**Settled (read from the code).**

- A card is born with a hash id and the drain assigns the real number at land, rewriting the hash across the filename, the card body and other cards' edges (`we:docs/agent/backlog-workflow.md`, JIT numbering). That rewrite covers files inside the repository only. The sources that hold the id (the orchestrator handoff, worker result files) live outside it, so they keep the hash until track rewrites them.
- Track does not re-derive the number. `landedNumberFor` (`we:scripts/lane-drain.mjs:823`) already resolves a hash to its landed number, read-only; `numberPendingHashes` (`we:scripts/lane-drain.mjs:615`) is the drain's own writer and is never called from here.
- A hash in a source line is an id, so an id-less-line rule is satisfied from the moment the card is filed, before the number exists. Once the number is known, track rewrites hash to number in the source line.
- The ledger records, per filed card: intake key, hash, pull request reference, source path. It exists until the pull request lands and is then cleared. It cannot live in the repository: writing it into a card would need a pull request of its own, which is the loop this slice exists to break. It lives in machine-local state outside the git tree.
- The reconcile core treats a ledger entry as "has a card, pending", so a line whose card is in an unlanded pull request is never reported as missing and never re-filed.
- Write-back puts the card id into the source line after the card is written, which is what lets a re-run find it. It follows the key, so a source line edited later cannot orphan its card.

**Open (settle in the design review).**

1. Ledger location and format: a state directory next to the conveyor's, one file per run, or one file for all runs. It must survive session end and be safe to read while another run appends.
2. The tracker tail. The epic 3383 tracker is one card that every note appends to, so two concurrent runs each appending a session update at the end of a 3000-line file conflict textually at the tail. Candidate strategies: a run lock so track runs are serialised (a singleton lease like the conveyor's `we:skills-src/conveyor/runner-lock.mjs`), a union-merge rule for that one file, or having note lines never touch the tracker from track at all. Leaning the run lock, since track runs are short and rare.
3. Write-back into a source the handoff command regenerates. The handoff file is overwritten wholesale each time, so a written-back id vanishes on the next handoff. That is settled in the handoff adapter slice (the command must carry ids forward); this slice provides the write-back primitive only.
4. A pull request that is closed without landing: how the ledger entry expires, and what happens to the source line that now points at a card that never existed.

## Done when

1. **Executable** — `node --test we:scripts/operations/__tests__/track-ledger.test.mjs` passes. After a fixture run, the ledger holds one entry per filed card and each source line holds its hash; with a stub of `landedNumberFor` returning numbers, the reconcile-ids step rewrites every source hash to its number and clears the entries; a second run of that step changes nothing.
2. **Executable** — the same suite proves the unlanded case: with the stub returning no number, the entries stay, the source lines keep the hash, and the read-only check reports those lines as pending and not as missing.
3. **Executable** — the same suite proves the chosen concurrency strategy: two runs started against one tracker fixture, the second is refused or waits as the design review decides, and the tracker fixture ends with both notes present exactly once.

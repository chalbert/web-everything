---
kind: task
parent: "4075"
status: open
scope: ["we:scripts/lib/salvage-index.mjs", "we:scripts/lib/lane-salvage.mjs"]
dateOpened: "2026-09-27"
tags: []
---

# salvage index append can be silently lost to a concurrent retention rewrite

Still-open Codex advisory finding from chalbert/web-everything#2788 (codex-correctness/correctness, [CONFIRMED]), never acted on before merge (2026-09-27). Re-checked against origin/main @5e6c2868e2 (2026-09-27) — code is UNCHANGED, finding still applies.

FINDING: we:scripts/lib/salvage-index.mjs's updateSalvageIndex (used by the retention pass, refreshSalvageIndex) reads the whole index.jsonl, computes a new list, then writes a temp file and renameSyncs it over the original — all inside withFileLock. But the ACTUAL append of a new salvage entry (we:scripts/lib/lane-salvage.mjs's salvageLane, the function that appends the "one line per salvaged lane" the file's own header describes) calls appendFileSync(salvageIndexPath(...), ...) directly, with NO lock at all — a completely separate, unlocked write path from updateSalvageIndex's locked read-mutate-rename cycle. So a salvage's raw append can land on disk in the window between a concurrent retention pass's read and its rename: the retention rewrite then replaces the file (based on its earlier read, taken before the append) with content that omits the just-appended row, silently dropping it. The bundle/files the append was recording still exist on disk, but the index row that makes them findable is gone.

EVIDENCE: read we:scripts/lib/salvage-index.mjs directly off origin/main — updateSalvageIndex's read/mutate/write/rename is the only locked path (withFileLock(`${p}.lock`, ...)); read we:scripts/lib/lane-salvage.mjs directly off origin/main — its append still calls appendFileSync(salvageIndexPath(salvageRoot), ...) with no lock acquisition of any kind.

PREVENTION (from the reviewer, still owed): route the salvage append through the SAME updateSalvageIndex lock (or an equivalent shared lock) so no writer to index.jsonl ever bypasses it, and add a deterministic interleaving test that appends between a retention pass's read and its rename and asserts the appended row survives.

Priority: not HIGH (the underlying salvage bundle/files are not deleted, only the index row that makes them discoverable — a human can still find them by hand; this is a durability/discoverability gap, not itself a close/resolve of the wrong PR or indefinite healing suppression).

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

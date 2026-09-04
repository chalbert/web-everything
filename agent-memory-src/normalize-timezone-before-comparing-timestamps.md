---
name: normalize-timezone-before-comparing-timestamps
description: "Never compare timestamps pulled from different commands/tools unless every one is explicitly pinned to the same timezone — macOS `stat -f \"%Sm\"` prints LOCAL time with no offset marker and looks exactly like it could be UTC."
metadata:
  type: feedback
---

**Never compare timestamps from different tools/commands (file mtimes, process heartbeats, log
lines, `date`, git commit dates, API timestamps) unless every one of them is explicitly pinned to
the same timezone — prefer UTC everywhere.** A silent local/UTC mismatch produces a plausible,
specific-sounding wrong duration, not an obvious error.

**Why:** hit live 2026-09-04, during the epic #3383 (mechanical dispatcher) investigation, while
diagnosing whether the conveyor's live runner loop was stalled. I compared a file's mtime against
"now" from two different commands: `date -u` (correctly UTC) and `stat -f "%Sm"` on macOS — which
prints LOCAL time with **no timezone marker**, so it looks like it could be UTC but isn't. The two
were compared directly with no timezone normalization, producing an apparent ~4-hour gap. That was
reported to the operator as a confident, specific diagnosis — "the conveyor's tick loop has stalled
for 4 hours" — which was flatly wrong. The real gap was ~3 minutes; local EDT is UTC-4, exactly
accounting for the illusion. Had to publicly walk back the diagnosis in the very next turn once
re-checked with `TZ=UTC stat -f "%Sm" -t "%Y-%m-%dT%H:%M:%SZ" <file>`.

**How to apply:**
1. Pin every timestamp source to UTC explicitly before comparing — e.g. `TZ=UTC stat -f "%Sm" -t
   "%Y-%m-%dT%H:%M:%SZ" <file>` instead of plain `stat -f "%Sm"` on macOS, and `date -u` rather than
   bare `date`.
2. Never assume a tool's default output timezone from how it "looks" — an unlabeled timestamp with
   no offset is not evidence it's UTC. macOS `stat -f "%Sm"` is the concrete trap: it is local time,
   unmarked, and reads as plausibly-UTC.
3. Sanity-check the offset assumption BEFORE stating a specific duration ("stalled for N hours", "N
   minutes old") to the operator as fact. If the gap happens to equal a whole-hour multiple close to
   the local UTC offset, that is itself a signal to re-verify rather than report — it's exactly the
   shape a timezone bug produces.

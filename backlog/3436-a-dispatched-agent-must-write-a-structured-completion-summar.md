---
bornAs: x7q7xvl
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-01"
tags: []
scope:
  - we:skills-src/review/
  - we:skills-src/conveyor/
  - we:scripts/conveyor/
  - we:scripts/operations/
---

# A dispatched agent must write a structured completion summary -- raw claude logs is unusable for machine or quick human read

Found live 2026-09-01, repeatedly: the ONLY way to learn what a finished dispatched review/fix agent actually
did is `claude logs <id>`, which returns a raw ANSI terminal capture (cursor-positioning codes, spinner frames)
with no structure — every real outcome tonight ("queued for a human," a genuine bug found, an error) had to be
recovered by hand: strip ANSI with a `perl` one-liner, grep for `⏺`-prefixed lines, eyeball the noise. The
operator, 2026-09-01: "we have to improve watch of agent" / "delay like this is not acceptable" — a real,
repeated cost tonight, not a one-off annoyance. `we:scripts/conveyor/review-status-tag.mjs` (landed this same
session) answers "is something working right now," but nothing answers "what did the one that just finished
actually conclude" without archaeology.

## Done when

1. **Executable** — every dispatched review/fix agent (`we:skills-src/review/review-agent-brief.md`,
   `we:skills-src/conveyor/fix-agent-brief.md`) writes a small structured completion record on exit (JSON:
   at minimum outcome/verdict, PR, runId if applicable, timestamp) to a well-known, greppable location —
   mirroring the pattern `we:scripts/operations/run-store.mjs` already uses for operation runs, not a new
   ad hoc format.
2. A real CLI (or an extension to `we:scripts/conveyor/review-status-tag.mjs`) reads that record back for a
   given PR/session with no `claude logs` call and no ANSI parsing anywhere in the read path.
3. A real test proves the record is written even when the dispatched agent's own work fails partway (a crash,
   a refused effect) — the summary must not depend on the happy path to exist.

---
kind: story
size: 5
parent: "xqmw8g9"
status: open
scope: ["we:skills-src/conveyor/", "we:skills-src/review/"]
dateOpened: "2026-09-24"
tags: []
---

# Sweep: turn prose rules in dispatched agent briefs into mechanical code

2026-09-24 root cause, repeated: dispatched agents skipped prose rules in their briefs (write the completion record, use Edit not Bash for card files, never end a turn on a background wait). Sweep every brief under we:skills-src/conveyor/ and we:skills-src/review/, list each imperative, and for each script-decidable one file or build the hook, wrapper step or gate that enforces it (memory rule 51, hookable vs judgment). Composes with the brief-rule ledger check (pending card x446oxf, under epic #3593), which keeps new prose rules from appearing unenforced; this card converts the existing ones.

## Done when

1. **Executable** — a ledger lists every imperative line in the dispatched briefs with its enforcer (hook,
   wrapper step, gate) or a `judgment` mark; the three rules broken on 2026-09-24 (completion record, Edit
   not Bash for card files, no turn-end on a background wait) each name a code enforcer with a test that
   fails when the rule is broken.

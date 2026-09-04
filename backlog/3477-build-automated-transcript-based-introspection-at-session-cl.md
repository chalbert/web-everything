---
bornAs: xvdli7k
kind: story
size: 5
parent: "3475"
status: open
dateOpened: "2026-09-04"
tags: []
---

# Build automated transcript-based introspection at session close/reap

Follow-on build for the ratified 3475 ruling: (1) a WE_INTROSPECTION_ENABLED env-var read helper, unset (falsy) by default, read fresh by each trigger's own script; (2) three trigger wire-ups -- the we:scripts/conveyor/session-reaper.mjs insertion point immediately before its stopSession call, a new we:.claude/settings.json SessionEnd hook entry, and a new SubagentStop hook entry -- all invoking one shared judge-pass script; (3) the judge-pass script itself: reads the session transcript (bounded/chunked for a transcript exceeding a single LLM call's context, observed up to 58MB), emits a we:scripts/conveyor/learnings-drop.mjs-shaped entry, and its rubric MUST include a scan for the raw-command/missing-operation pattern (we:agent-memory-src/act-as-if-a-ui-were-the-one-filing-changing-items.md's would-a-UI-button-do-this test), emitting kind: missing-convention naming #3029 when found -- this is a settled requirement per 3475's own ruling, not left to build-time discretion; (4) the origin: self-report | auto-introspection optional field added to we:scripts/conveyor/learnings-drop.mjs's ALLOWED_KEYS, mirroring the #3421 OPTIONAL_HICCUP_KEYS precedent; (5) the automated caller scrubs BEFORE calling appendEntry via we:scripts/lib/secret-scrub.mjs's scrubReasons, denying on any hit (never silently redacting); (6) true OS-level detachment for the spawned judge process must be proven, not merely asserted, and the invoked script must never exit SubagentStop's code 2 on any path. Sonnet-rung, low-effort model/effort tier per this repo's own already-ratified #1855/#3106 doctrine -- a mechanical application, not a live choice for this item.

## Done when

1. **Executable** — `WE_INTROSPECTION_ENABLED=1` set, then a real session (or a fixture standing in for one)
   terminates via each of the three trigger kinds (background reap, `SessionEnd`, `SubagentStop`) and an entry
   matching `we:scripts/conveyor/learnings-drop.mjs`'s schema — carrying `origin: 'auto-introspection'` —
   lands in the pool for each. `WE_INTROSPECTION_ENABLED` unset (the default) produces zero entries across all
   three.
2. **Executable** — a fixture transcript containing a raw hand-rolled command that stood in for a missing
   `we:scripts/operations/*.mjs` operation produces a judge finding with `kind: missing-convention` naming
   `#3029` — this specific check is asserted directly, not just "the judge ran."
3. **Executable** — a fixture transcript containing a realistic secret/credential-shaped string is REJECTED
   (denied, not silently redacted) by the pre-append `scrubReasons` gate; the rejection is observable (a log
   line or a returned error), not a silent drop.
4. A `SubagentStop`-triggered run never exits code 2 on any path (success, judge failure, scrub rejection) —
   asserted by a fixture run that forces each of those paths and checks the exit code.
5. True OS-level detachment is proven, not asserted: the spawned judge process is shown to survive its parent
   hook process exiting (e.g. the parent process is killed immediately after spawn and the judge still
   completes and appends its entry).
6. `origin` is added to `we:scripts/conveyor/learnings-drop.mjs`'s `ALLOWED_KEYS` as optional; every existing
   caller that omits it produces a byte-identical entry to today (a regression test pins this).

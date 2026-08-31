---
bornAs: x39jwee
kind: story
size: 5
parent: "3422"
status: open
dateOpened: "2026-08-31"
tags: []
---

# Auto-file+propose a fix on a blocking delivery hiccup, gated by approval; non-blocking hiccups file straight through

Follow-up build story from `#3422`'s ruling. A blocking hiccup (the tick did not proceed — a real code
defect, or a dispatched agent punting to free-form prose instead of a predefined structured response) gets
auto-filed with a proposed fix, gated behind explicit human approval before it lands or queues. A non-blocking
hiccup (delivery succeeded but surfaced something worth improving) gets filed only, no gate, no proposed fix.
Both route through the existing learnings-pool/`/harvest` pipeline rather than a parallel one, triggered
mechanically at the moment of the hiccup instead of waiting for a human `/note`.

## Done when

1. **Executable** — a classifier derives blocking-vs-non-blocking directly off the tick core's own state
   (`we:skills-src/conveyor/runner.mjs` / `we:scripts/conveyor/tick-core.mjs` — did this tick's dispatch get
   suppressed/held, or did it proceed), with a test pinning at least one case of each shape, including
   `#3416`'s own guard-suppression case and `#3412`'s free-form-question case as named regression fixtures.
2. **Executable** — a mechanical sink writes into the SAME learnings-pool store
   `we:skills-src/capture-learning` already writes to (not a new store), stamping a blocking-bucket entry
   with the proposed fix and an explicit approval-pending flag; a non-blocking entry carries neither.
3. **Executable** — `/harvest` (or a lighter-weight companion trigger, whichever proves cheaper to wire) reads
   the approval-pending flag and refuses to file+queue a blocking-bucket entry's fix until it is cleared;
   a non-blocking entry files straight through with no gate check.
4. `npm run check:standards` — no new errors.

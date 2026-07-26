---
bornAs: x28wmm7
kind: story
size: 3
status: resolved
blockedBy: ["2670"]
scope: ["we:scripts/lib/"]
dateOpened: "2026-07-26"
dateStarted: "2026-07-26"
dateResolved: "2026-07-26"
tags: []
---

# Give the jury design-pixels screenshot-vs-target visual lens its callable form via the shared comparator

The visual → screenshot-vs-target lens in we:scripts/lib/design-pixels-adapter.mjs has no callable form (deferred in #2657). Wire the Card-1 comparator in so the jury visual lens runs an automated screenshot-vs-baseline diff instead of a by-eye-only judgment. This gives the jury's mandatory visual grounding a real primitive to call, closing the gap where a visual juror could only report it judged by eye and could not run the automated diff. Under jury epic #2649.

## Context — shared cluster framing

Delivery agents today self-review CODE only (an adversarial diff-review subagent). Nothing compares the RENDERED UI against the design mock. Result: the console-board cluster (#2587 / #2588 / #2604 / #2660) shipped code-correct but with a large visual delta from the design artifact. The jury's design-pixels adapter (we:scripts/lib/design-pixels-adapter.mjs, from resolved #2657) defines a `visual → screenshot-vs-target` lens, but that primitive has no callable form yet. plateau-app has Playwright (plateau-app:playwright.config.ts, plateau-app:tests/e2e/) but no visual/baseline harness. The fix is ONE shared comparator, reused at build-time (Layer 1) and by the jury (Layer 2, this card). Three-card cluster: the comparator primitive (#2670), Layer-1 build-time self-review (#2672), Layer-2 jury visual grounding (#2671).

## What this card wires — Layer 2

The `visual → screenshot-vs-target` lens in we:scripts/lib/design-pixels-adapter.mjs was registered as a DEFERRED method in #2657, pending the visual-diff primitive. Wire the Card-1 comparator (#2670) in so the jury's visual lens runs an AUTOMATED screenshot-vs-baseline diff instead of a by-eye-only judgment.

Today a visual juror can only judge by eye and report it could not run the automated diff — the lens is ungrounded. After this, the lens calls the shared comparator and returns a real `{ match, delta, findings }` grounding. A surface with no baseline stays a documented skip (the comparator's own contract), which the juror reports as an ungrounded lens rather than a fail.

blockedBy: the Card-1 comparator (#2670) — the lens has nothing to call until the shared primitive exists.

## Relates to

- we:scripts/lib/design-pixels-adapter.mjs — the adapter this change lands in.
- jury epic #2649.

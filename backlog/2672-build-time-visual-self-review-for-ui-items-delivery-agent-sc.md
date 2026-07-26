---
bornAs: xrv47p7
kind: story
size: 5
status: open
blockedBy: ["2670"]
scope: ["we:skills-src/conveyor/"]
dateOpened: "2026-07-26"
tags: []
---

# Build-time visual self-review for UI items — delivery agent screenshots the rendered surface and diffs it against the baseline before PR

For UI-locus items, the conveyor delivery brief (we:skills-src/conveyor/delivery-agent-brief.md) gains a visual self-check step AFTER the code self-review: render the built surface against the running dev server, screenshot it, the agent READS the screenshot and runs the Card-1 comparator against the committed baseline, and iterates to visual convergence BEFORE opening the PR. A surface with no committed baseline still gets the agent's by-eye pass. Enabler dependency: baseline mock PNGs must be committed (operator-provided, exported from the design artifact). Motivated by the console-board cluster shipping code-correct but visually off.

## Context — shared cluster framing

Delivery agents today self-review CODE only (an adversarial diff-review subagent). Nothing compares the RENDERED UI against the design mock. Result: the console-board cluster (#2587 / #2588 / #2604 / #2660) shipped code-correct but with a large visual delta from the design artifact. The jury's design-pixels adapter (we:scripts/lib/design-pixels-adapter.mjs, from resolved #2657) defines a `visual → screenshot-vs-target` lens, but that primitive has no callable form yet. plateau-app has Playwright (plateau-app:playwright.config.ts, plateau-app:tests/e2e/) but no visual/baseline harness. The fix is ONE shared comparator, reused at build-time (Layer 1, this card) and by the jury (Layer 2). Three-card cluster: the comparator primitive (#2670), Layer-1 build-time self-review (#2672), Layer-2 jury visual grounding (#2671).

## What this card adds — Layer 1

For UI-locus items, the conveyor delivery brief (we:skills-src/conveyor/delivery-agent-brief.md, published to we:.claude/skills/conveyor/delivery-agent-brief.md) gains a VISUAL self-check step that runs AFTER the existing code self-review and BEFORE the PR is opened:

1. render the built surface against the running dev server;
2. screenshot it;
3. the agent READS the screenshot (sighted) and runs the Card-1 comparator (#2670) against the committed baseline;
4. iterate to visual convergence BEFORE opening the PR — the same converge-before-PR discipline the code review already enforces.

A surface with NO committed baseline still gets the agent's by-eye pass — no false-fail, no skipped review.

Enabler dependency (explicit): baseline mock PNGs must be committed — operator-provided, exported from the design artifact. Without a baseline the check can only fall back to by-eye; the automated layer only bites once baselines exist.

blockedBy: the Card-1 comparator (#2670) — this layer has nothing to call until the shared primitive exists.

## Relates to

- the console-board cluster (#2587 / #2588 / #2604 / #2660) — shipped code-correct but visually off; this build-time gate is the missing check that would have caught it.

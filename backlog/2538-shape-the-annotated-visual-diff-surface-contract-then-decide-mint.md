---
kind: decision
size: 3
status: open
dateOpened: "2026-07-18"
tags:
  - standards
  - visual-diff
  - research
  - console-board
---

# Shape the annotated visual-diff surface contract, then decide mint

Graduated from decision [#2533](/backlog/2533-console-board-derived-ui-standards.md) (Fork 5). Ratified: **commission the shaping research first; the mint (or not) is decided on its result.** `preparedDate` is intentionally NOT set — this needs the research before it is ready to rule.

The pattern is a **before/after annotated visual-diff surface**: two panes (e.g. design vs built), with numbered, clickable, **typed** delta regions (real drift vs "expected, not reached yet"). No existing standard owns side-by-side visual comparison — `we:src/_data/intents/audit-timeline.json` is a *text/event feed*, the standard this is measured against.

The pattern is unmistakably real and recurring — which is why it clears the corrected minting bar as a *candidate*: visual-regression tools (**Percy, Chromatic, reg-suit**, Playwright/Storybook snapshot review) **are literally annotated visual-diff surfaces** (baseline vs new, highlighted + accept-per-region); GitHub/GitLab **PR diff** (side-by-side + inline, per-hunk accept); **Figma / Abstract** version-compare. What is missing is the **contract shape**, not the justification.

So the research to commission (a `/research/` topic) must shape:
- **the delta-type taxonomy** — real drift vs expected-not-yet-reached vs intentional change, etc.
- **the anchor payload** — how a delta region is located/anchored across the two panes.
- **the accept / typed-region model** — how a region is reviewed and accepted, per-type.

Mint (or not) is decided **on that result** — do NOT mint blind now (ratifying an unshaped contract bakes in guesses), and do NOT reject/park for "no second consumer" (a struck reason; the pattern is established prior art).

**Acceptance:** a `/research/` topic is commissioned and published shaping the three contract questions above (delta-type taxonomy · anchor payload · accept/typed-region model), measured against `we:src/_data/intents/audit-timeline.json`; the decision is then prepared (`preparedDate` set) with a mint/no-mint recommendation grounded in that research.

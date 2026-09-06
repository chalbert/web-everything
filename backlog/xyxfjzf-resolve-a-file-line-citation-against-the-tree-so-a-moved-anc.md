---
kind: story
size: 3
status: open
dateOpened: "2026-09-06"
tags: []
relatedReport: reports/2026-09-06-open-story-staleness-audit.md
---

# Resolve a file:line citation against the tree, so a moved anchor fails the gate instead of rotting silently

The largest staleness class found by the 2026-09-06 open-story audit: cards cite file:NNN anchors that move as the file grows. Every we:docs/agent/platform-decisions.md line reference in the 445-card audited set is off by 130-520 lines (the file reached 4138); we:scripts/lib/review-escalation.mjs cites drift 100-260; #3128 alone carries six wrong we:scripts/lib/jury-core.mjs cites. The prose and anchors stay correct - only the numbers rot, silently, so a reader is sent to unrelated content. we:scripts/check-standards.mjs already resolves a code-locus path (#2821 gate 5) but does not check the line range. Extend it to verify a cited line range still plausibly contains the named symbol, and warn when it does not.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

## Done when

1. **Executable** — `npm run check:standards` WARNS on a backlog item whose code locus names a line
   range that no longer contains the cited symbol, and is silent once the range is corrected.
   Reproduce with #3128, whose six `we:scripts/lib/jury-core.mjs` cites are each off by 7-441 lines.
2. **Skip-safe, not fail-open** — a `fui:` / `plateau:` locus, or a path absent from this checkout,
   is skipped *explicitly* (the shape `we:scripts/check-standards.mjs` already prints for a missing
   sibling), never silently passed.
3. A test covers both arms: a locus whose range still holds the symbol passes; one whose range has
   drifted warns.

## Why a line range and not just the path

`we:scripts/check-standards.mjs` already resolves the *path* half of a code locus (#2821 gate 5), so
a deleted file is caught. The rot this item targets is subtler and far more common: the file still
exists, the prose is still right, and only the number moved — so nothing fails and a reader following
the cite lands on unrelated content. The 2026-09-06 audit found this to be the single largest
staleness class across 445 open cards.

## Scope note

A cheap, high-yield heuristic beats exactness here: read the cited range and check it still contains
the symbol or phrase the prose names. A warn (not an error) is the right severity — a legitimately
reworded anchor should not block a land.

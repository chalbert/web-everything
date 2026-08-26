---
kind: story
size: 5
status: open
scope: ["we:scripts/readiness/red-main-remediation.mjs"]
dateOpened: "2026-08-26"
tags: []
---

# Arm the red-main stop-the-line — drain self-polls main and self-freezes, revert-to-green stays drain-owned

DEFERRED BY THE OPERATOR 2026-08-26 — recover manually until it hurts. #2681 built the dispatch-freeze + revert-authority remediation and `we:scripts/merge-ai-prs.mjs` already REFUSES to land while the marker is present, but nothing ever writes the marker, so the lever is dormant. Two constraints fix the design: the marker is a gitignored `.conveyor/` local file, so CI on another machine cannot arm it — the drain must poll main own CI status at the top of its sweep and self-freeze; and auto-revert must run THROUGH the drain, since a workflow pushing a revert to main would be a second writer, forbidden by the event-driven-land-is-wake-only anchor in `we:docs/agent/platform-decisions.md` clause 1. The pure decidePostLand core already names the revert target. #2681 assumed this could never fire because the test-selection shrink is opt-in and off — turning strict off re-opens post-land reds from a different direction, which is what makes arming this eventually necessary.

## Done when

1. **Executable** — TODO: a command that fails before this item lands and passes after.

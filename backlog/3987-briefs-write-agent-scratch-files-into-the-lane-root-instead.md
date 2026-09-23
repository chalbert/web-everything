---
bornAs: xtrqagm
kind: task
parent: "3383"
status: open
dateOpened: "2026-09-23"
tags: []
---

# briefs write agent-scratch files into the lane root instead of a dedicated scratch dir

we:scripts/lib/lane-litter.mjs's allowlist (extended by #3383/3986) is a symptom-side fix: delivery/converge/
open-pr/land-pr briefs (we:skills-src/conveyor/delivery-agent-brief.md, we:skills-src/conveyor/delivery-agent-brief-v2.md,
we:scripts/operations/deliver-item-wrapper.mjs, we:scripts/converge-cli.mjs) write `.pr-body*`, `.open-pr*`,
`we:.pr-land-result.json`, and `.converge-*` scratch files straight into the LANE ROOT, so every acquire/release/
health-watch pass must keep re-deriving "is this litter or real work?" from filename pattern-matching alone —
and any NEW scratch shape a future brief adds is invisible to the pool until an incident (like #3383's) adds it
by hand. Moving these briefs to write into one dedicated, already-gitignored scratch directory (e.g. `.scratch/`
inside the lane) would let the pool treat "anything under `.scratch/`" as unconditionally safe-to-discard by
construction, with no per-filename allowlist to maintain at all. This item is the audit + migration of every
brief/script that writes lane-root scratch today, done carefully (each write site individually verified to have
no OTHER reader depending on the old root-level path — `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs`
already asserts several exact root paths) — large enough to warrant its own item rather than folding into #3383's
narrower allowlist-and-acquire-logic fix.

## Done when

1. **Executable** — every scratch-file write site listed above writes under the lane's dedicated scratch
   directory instead of the lane root, `git status --porcelain` in a lane mid-delivery/mid-converge shows
   nothing outside that one directory, and the existing `we:scripts/lib/__tests__/lane-litter.test.mjs` /
   `we:scripts/operations/__tests__/deliver-item-wrapper.test.mjs` suites (updated for the new paths) pass.

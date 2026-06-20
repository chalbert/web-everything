---
kind: story
status: resolved
size: 3
dateOpened: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: none
tags: [backlog, readiness, prioritisation, gate]
---

# CTA invariant — every not-ready item must name its next action

Made it structurally impossible for an OPEN backlog item to render as a bare "not ready" with no
call-to-action. Surfaced by #1004 (the Web Charts build epic): it was `project-pending`, which demoted it
to Tier C and — because `sliceable` was defined as `⊂ Tier A` — suppressed its **slice** cue, so the only
pill it showed was the dead-end "project pending · webcharts" link. The actionable next step (slice the
epic into its build slices) was invisible.

Fix, three parts:

1. **`sliceable` is now orthogonal to tier** (like `splittable`) — an open epic with cleared blockers is
   sliceable regardless of `projectPending`/`humanGate`, because slicing is *decomposition* (an authoring
   act), not building a leaf into a not-yet-shipped standard. So #1004 is Tier C **and** "ready to slice".
   (`we:src/_data/backlog.js`)
2. **The project-pending pill is suppressed on epics** in favour of the slice/resolve/tracking cue, so a
   `concept`-project epic reads cleanly as "epic to slice". (`we:src/_includes/backlog-badges.njk`)
3. **`hasCta` invariant + hard gate** — the loader derives `hasCta` as the exact union of every pill the
   Prioritisation table can render (tier-A/B badge · batch · slice · split · stop-the-world · human-gate ·
   blocked-by · project-pending), and `check:standards` **errors** on any open item where it's false. A
   not-ready item can never again ship as a dead end. (`we:src/_data/backlog.js`,
   `we:scripts/check-standards.mjs`)

Also cleared the status-drift that triggered the investigation: webrealtime and webpositioning were
`concept` despite shipped runtime + conformance work (their resolved build items are tied via `parent:`
chains, not `relatedProject`, so the shipped-surface proxy read 0). Graduated both `concept → poc` (the
#617 fix), which correctly dropped #1184/#1194/#1186 out of the project-pending hold. webcharts stays
`concept` — its design surface shipped but the SVG renderer/registry runtime genuinely doesn't exist, so
#1004 is a real "slice me to build it" epic, not drift.

Documented as the **CTA invariant** in `we:docs/agent/backlog-workflow.md` (principle-conformance
pre-flight): the per-reason demotions (`projectPending`, `humanGate`, `blockedBy`, oversized, unsliced
epic) are branches of one guarantee — every not-ready item names a way forward.

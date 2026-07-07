---
kind: story
size: 3
status: resolved
dateOpened: "2026-07-07"
dateStarted: "2026-07-07"
dateResolved: "2026-07-07"
tags: []
---

# Drain post-land collision-heal (#2071) silently didn't fire on the #2316 double-land — make a duplicate NNN reaching main impossible or loud

On 2026-07-06 the pipeline batch's two seeds both landed at #2316 (PRs #179 renumber-fix + #180 frontierui-CI); the drain's post-land collision-heal (#2071, we:scripts/backlog-renumber-collisions.mjs) never fired, leaving a duplicate id on origin/main that failed the check:standards uniqueness rule GLOBALLY and turned every open PR's required test check red — the whole pipeline stalled. Healed by hand by running the SAME healer, which decided deterministically (newer-yields: #180 frontierui yielded #2316 to #2317) — so the decider works when invoked; the drain just didn't invoke it (or it errored silently) on the second couple's land. Possible interaction: #179 landed FIRST and its own change to the renumber/heal scoping (the #2314 fix in we:scripts/backlog/renumber-collisions.mjs) may have altered how #180 got healed. Make the future deterministic: (a) find why the post-land heal didn't fire on #180's land; (b) add a hard post-land assert/tripwire so the drain FAILS LOUDLY and never silently leaves a duplicate NNN on main (re-run the duplicate-id detection after each land, abort+alert on a dup); (c) ensure the heal runs on every land path, not only single-couple. Converges with #2248 (pre-merge duplicate-NNN gate blocks the 2nd colliding PR at CI — prevention) and #2289/#2288/#2291 (structural drain-only numbering + demote self-heal to a tripwiring backstop). relatedTo #2071, #2248, #2312, #2291, #2289, #2314.

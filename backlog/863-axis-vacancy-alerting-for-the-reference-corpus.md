---
type: idea
workItem: story
size: 2
parent: "583"
status: resolved
dateOpened: "2026-06-17"
dateStarted: "2026-06-17"
dateResolved: "2026-06-17"
graduatedTo: "scripts/check-axis-vacancy.mjs (npm run check:axis-vacancy — per-category live-source floor alerter)"
tags: []
---

# Axis-vacancy alerting for the reference corpus

Flag when a corpus category drops below N live sources (axis vacancy), so coverage gaps surface proactively. Unblocked build against the resolved #597 registry.

## Progress

- **Resolved 2026-06-17.** Built `we:scripts/check-axis-vacancy.mjs` (`npm run check:axis-vacancy`):
  treats each `we:benchmarkCorpus.json` `category` as a coverage **axis** and counts live vs `retired`
  (#584) sources per axis, flagging any below a floor (default 2; `--threshold=N`). Pass
  `--with-sweep=<report>` to also count #585-`gone`/`unreachable`/`superseded` corpus sources as
  not-live. Exits non-zero on any vacancy so it can gate CI or the #367 scheduled refresh. A source in
  an undefined category surfaces as its own vacant axis (a schema gap caught for free).
- **Tested + verified:** `computeAxisVacancy()` is pure — 6-case offline suite
  (`we:scripts/__tests__/check-axis-vacancy.test.mjs`, green) covers retirement-driven and sweep-driven
  vacancy, the threshold knob, the orphan-category gap, and a standing real-corpus regression guard. A
  live run reports all 5 axes healthy (`web-component-system` 3/4 live, 1 retired — above the floor).
  Documented in `we:docs/agent/reference-retirement.md` (§ "Coverage floor").

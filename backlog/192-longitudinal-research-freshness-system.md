---
kind: epic
status: resolved
dateOpened: "2026-06-08"
dateStarted: "2026-06-13"
dateResolved: "2026-06-13"
graduatedTo: none
tags: [research, freshness, longitudinal, versioning, reports, staleness, meta, axis-discovery]
relatedProject: webdocs
crossRef: { url: /research/, label: "/research/ topic index" }
---

# Longitudinal research freshness — keep research current over time without losing history, and surface new axes to evaluate

Research in this repo is a point-in-time snapshot: a topic is investigated once, written
to a dated `we:reports/YYYY-MM-DD-topic.md`, and (optionally) promoted to a `/research/{id}/`
topic. Nothing today re-evaluates a topic as the web platform and the framework landscape
move. A survey of "what frameworks provide for i18n" written 2026-02 silently rots; a
finding can be overtaken by a shipped standard; and **whole new subjects or evaluation axes
appear that the original research never considered**. This epic is the system that keeps the
research corpus *alive*: refreshable, history-preserving, and self-extending.

Three capabilities, none of which exist yet:

**1 — Refresh without losing history.** When a topic is re-researched, the new findings must
supersede the old *without* destroying the prior report — the dated trail is the audit value.
The model is likely a chain of dated reports under one stable topic id (the de-dated slug
already used by `/research/`), where the topic surfaces the latest as canonical and links the
superseded versions as history. Needs: a "supersedes" link between reports, the `/research/`
page rendering "current + previous revisions," and a rule that refresh = *new dated report*,
never an in-place overwrite of an old one.

**2 — Freshness signals.** Every topic carries a `lastReviewed` date (distinct from
`dateOpened`) and a staleness state derived from age and/or volatility, surfaced on
`/research/` so a reader can see at a glance which topics are current and which are overdue
for review. A `check:standards` warning when a topic exceeds its review horizon would make
staleness actionable rather than invisible.

**3 — New-axis / new-subject discovery.** The hardest part: capturing subjects and evaluation
axes that *didn't exist or weren't considered* when the research was first done (a new browser
API ships, a new framework pattern emerges, a new dimension becomes worth scoring). This is a
recurring sweep that asks "what has changed in the landscape that our research doesn't yet
account for?" and **feeds the backlog** — each newly-surfaced axis or subject becomes its own
item or a refresh trigger on an existing topic. Mechanism is open (periodic prompt, a
checklist, an agent sweep), but the output channel is the existing tracker.

## Resolution (2026-06-13)

All three capabilities are delivered or homed; the umbrella resolves with `graduatedTo: none`
(it enhanced the existing `/research/` registry + renders + validator, spawning no single new
entity). Delivery trail:

- **Foundation forks → #441** (resolved): history model, freshness-metadata home, staleness
  enforcement, scope-of-"research" — all four ratified at their bold defaults on the shared
  surfaces (`we:researchTopics.json` + the `/research/` renders + `check:standards`).
- **Capability 1 — refresh without losing history → #478** (resolved): refresh = a new dated
  report + bidirectional `supersedes`/`supersededBy`, prior revisions rendered as history.
- **Capability 2 — freshness signals → #477** (resolved, on the #476 schema/badge foundation):
  `lastReviewed` + `reviewHorizon`, derived staleness with the RFC 5861 grace band, the
  reader badge, and the warn-only `check:standards` rule.
- **Capability 3 — axis-discovery trigger:** carved and **decided in #349** (resolved) as the
  shared mechanism — *manual periodic sweep first, scheduled automation deferred* — so there is
  one refresh engine, not two. The manual build shipped as #366 (resolved); the
  scheduled-automation half is **#367** (`blockedBy: ["192"]`), which this resolution unblocks.
  The output of that sweep is itself new backlog items, so the system partly maintains the
  backlog as a side effect.

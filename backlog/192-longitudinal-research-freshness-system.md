---
type: idea
workItem: epic
status: open
dateOpened: "2026-06-08"
tags: [research, freshness, longitudinal, versioning, reports, staleness, meta, axis-discovery]
relatedProject: webdocs
crossRef: { url: /research/, label: "/research/ topic index" }
---

# Longitudinal research freshness — keep research current over time without losing history, and surface new axes to evaluate

Research in this repo is a point-in-time snapshot: a topic is investigated once, written
to a dated `reports/YYYY-MM-DD-topic.md`, and (optionally) promoted to a `/research/{id}/`
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

## Open design points

The forks live in their own decision items (forks don't belong in an epic body):

- **Foundation forks → #441** (`blockedBy`): history model, freshness-metadata home, staleness
  enforcement, and scope-of-"research". These four land on the same surfaces
  (`researchTopics.json` + the `/research/` renders + `check:standards`), so they resolve
  together. Each carries a stated lean — a near-ratification pass. Resolving #441 unblocks
  capabilities 1 and 2 (refresh-without-losing-history, freshness signals) as build slices.
- **Axis-discovery trigger** (capability 3): manual periodic skill/command, vs. a scheduled
  agent sweep, vs. piggy-backing on whenever a topic is touched — process vs automation. This
  one is genuinely open and is *not* part of #441; carve it as its own decision when capability
  3 is taken up.

Build slices fall out once #441 rules (foundation → staleness + history/supersedes). The
output of capability 3 is itself new backlog items, so this system partly maintains the
backlog as a side effect.

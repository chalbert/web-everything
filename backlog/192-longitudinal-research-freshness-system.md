---
type: idea
workItem: epic
size: 8
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

## Open design points (resolve before building)

- **History model:** dated-report chain under one topic id with a `supersedes` pointer, vs. a
  single living report with an in-file changelog. The chain preserves the literal historical
  document; the changelog is lighter but loses the original framing. Leaning chain.
- **Freshness metadata home:** `researchTopics.json` (`lastReviewed`, `reviewHorizon`/volatility),
  vs. report frontmatter, vs. both. The topic registry is the natural render source for
  `/research/`, so it likely owns the surfaced date.
- **Staleness enforcement:** warn-only in `check:standards`, vs. a visible badge on `/research/`,
  vs. both. Almost certainly both — badge for readers, warning for maintainers.
- **Axis-discovery trigger:** manual periodic skill/command, vs. a scheduled agent sweep, vs.
  piggy-backing on whenever a topic is touched. Affects whether this is process or automation.
- **Scope of "research":** `/research/` topics only, or every `reports/*.md` (including
  backlog-mirrored pointer reports)? Freshness probably applies to promoted topics; ad-hoc
  reports may stay frozen by design.

Likely splits into child stories once the history model and freshness-metadata home are
settled (hence epic). The output of capability 3 is itself new backlog items, so this system
partly maintains the backlog as a side effect.

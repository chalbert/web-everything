---
kind: story
size: 2
locus: webeverything
status: resolved
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
graduatedTo: "we:docs/agent/backlog-workflow.md"
tags: [process, decision-workflow, gate]
---

# Harden fork-readiness grounding: require a standard-layer (intents + platform-decisions) check before mapping vocabulary to a component

Reinforce the decision/prepare gate so a recommended default can't map domain vocabulary onto a component without first grounding in the standard layer. Add a mandatory standard-layer-grounding step to we:docs/agent/backlog-workflow.md's fork-readiness pass and the /prepare skill: before any vocab→component mapping, grep we:src/_data/intents/ and we:docs/agent/platform-decisions.md for an intent/decomposition that already owns it; a badge/pill/label/status/chip/tag mapping must cite its owning intent. Surfaced on #1621, where a prepared default put taxonomy pills on the status badge — re-conflating what #1319 split into Status Indicator / Tag / Notification Marker — because grounding checked the impl tree and skipped the standard layer.

## Progress (resolved 2026-06-23, batch-2026-06-23-1689-1500)

Added the standard-layer-grounding step to both gates:

- **`we:docs/agent/backlog-workflow.md`** — a new bullet in the *Fork-readiness pass* (right after *Verify
  the item's grounding claims*): a vocab→component mapping (badge/pill/label/status/chip/tag, or any UX
  noun) must grep `we:src/_data/intents/` + `we:docs/agent/platform-decisions.md` for the owning intent
  **and cite it** before the mapping is endorsed; grounding only the impl tree re-conflates
  standard-layer-split vocabulary. Carries the #1621/#1319 worked example (taxonomy pills on the status
  badge re-merged Status Indicator / Tag / Notification Marker).
- **`we:.claude/skills/prepare-decision-item/SKILL.md`** — the mirror sub-step under step 1 (prior-art
  research), pointing back to the backlog-workflow bullet, with the same grep + cite-the-intent rule and the
  #1621 example.

Net rule: a vocab→component mapping that can't cite an owning intent is either ungrounded (do the grep) or a
genuine gap (the new intent *is* the fork) — never a silent default. WE gate clean (no new findings).

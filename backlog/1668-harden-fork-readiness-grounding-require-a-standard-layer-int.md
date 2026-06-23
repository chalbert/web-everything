---
kind: story
size: 2
locus: webeverything
status: open
dateOpened: "2026-06-23"
tags: [process, decision-workflow, gate]
---

# Harden fork-readiness grounding: require a standard-layer (intents + platform-decisions) check before mapping vocabulary to a component

Reinforce the decision/prepare gate so a recommended default can't map domain vocabulary onto a component without first grounding in the standard layer. Add a mandatory standard-layer-grounding step to we:docs/agent/backlog-workflow.md's fork-readiness pass and the /prepare skill: before any vocab→component mapping, grep we:src/_data/intents/ and we:docs/agent/platform-decisions.md for an intent/decomposition that already owns it; a badge/pill/label/status/chip/tag mapping must cite its owning intent. Surfaced on #1621, where a prepared default put taxonomy pills on the status badge — re-conflating what #1319 split into Status Indicator / Tag / Notification Marker — because grounding checked the impl tree and skipped the standard layer.

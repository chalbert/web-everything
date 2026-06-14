---
type: idea
workItem: story
size: 1
parent: "586"
status: open
locus: plateau-app
blockedBy: ["589"]
dateOpened: "2026-06-14"
tags: []
---

# Technical Configurator option — reaction update strategy

Per #370 Fork 5: add a Technical Configurator option (plateau-app) for the reaction toggle's update strategy — optimistic | pessimistic (how the toggle reflects before server confirm). The ReactionSummary optimisticallyUpdated field is the schema; this card is the Configurator UI. Note: reaction sync transport is NOT carded here — it's the webrealtime Configurator domain's option, cross-ref'd. blockedBy #589.
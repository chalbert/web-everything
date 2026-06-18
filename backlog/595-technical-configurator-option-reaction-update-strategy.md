---
type: idea
workItem: story
size: 1
parent: "586"
status: resolved
locus: plateau-app
blockedBy: ["589"]
dateOpened: "2026-06-14"
dateStarted: "2026-06-14"
dateResolved: "2026-06-14"
graduatedTo: plateau-app/src/technical-configurator/seed-reaction-update-strategy.ts (Reaction Update Strategy Configurator domain)
tags: []
---

# Technical Configurator option — reaction update strategy

Per #370 Fork 5: add a Technical Configurator option (plateau-app) for the reaction toggle's update strategy — optimistic | pessimistic (how the toggle reflects before server confirm). The ReactionSummary optimisticallyUpdated field is the schema; this card is the Configurator UI. Note: reaction sync transport is NOT carded here — it's the webrealtime Configurator domain's option, cross-ref'd. blockedBy #589.

## Progress

- Added the `reaction-update-strategy` Technical Configurator domain in plateau-app (`plateau:src/technical-configurator/seed-reaction-update-strategy.ts`) — 3 outcome axes (perceived responsiveness, on-failure handling, connection assumption) and the two strategies **optimistic** (`optimisticallyUpdated: true` — reflect now, roll back on failure) vs **pessimistic** (`false` — confirm, then reflect). Modeled per the seed pattern (developer expresses outcomes; strategy is the answer).
- Registered it in `we:provider.ts` (the DOMAINS list) and wired 3 presets in `plateau:presets.ts` + `plateau:configurator.ts` (snappy-toggle / never-show-unconfirmed / flaky-network).
- Scope honored: the reaction **sync transport** is explicitly NOT modeled here — left to the webrealtime domain (noted in the seed doc + tagline).
- Gate: `npm test` in plateau-app green (113/113). Code commits to plateau-app; this tracker entry to webeverything.
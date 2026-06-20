---
type: idea
workItem: story
status: resolved
size: 2
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "intent:timed-advance"
relatedProject: webintents
tags: [deck, autoplay, wake-lock, webintents, advanceable-media]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Autoplay / timed-advance — extend carousel autoplay + Wake Lock

Per-slide timing, pause-on-interaction, resume, loop, and Screen Wake Lock during kiosk/autoplay. [we:carousel](../src/_data/blocks/carousel.json) already owns single-rate autoplay, so this is an **extension** of that kernel, homed in **webintents** and shared with the advanceable-sequence family (#1179). *Updated/extension.*

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored intent `timed-advance` in **webintents** (`we:src/_data/intents/timed-advance.json`): generalises the carousel's single-rate autoplay to per-item timing + adds Screen Wake Lock, as the timed member of #1179. Axes `timing` (uniform/per-item), `pause` (on-interaction/manual-only), `wakeLock` (held/none); end-of-sequence boundary defers to advanceable-sequence. WCAG 2.2.2 pause-control + reduced-motion noted. Auto-renders at `/intents/timed-advance/`.

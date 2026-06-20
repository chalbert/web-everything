---
type: idea
workItem: story
status: resolved
size: 3
blockedBy: ["1175"]
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "intent:interstitial-insertion"
relatedProject: webintents
tags: [deck, interstitial, overlay, ads, webintents, advanceable-media]
relatedReport: reports/2026-06-19-deck-slide-standards.md
---

# Interstitial / overlay insertion (pre-roll / mid-roll / banner)

A **scheduled-insertion intent** — content inserted at start / mid-sequence / as overlay (pre-roll, mid-roll, banner); skippable vs forced; resume-after. Composes webintents (insertion) + webportals (overlay); **shared with video ad-breaks**. A member of the advanceable-sequence family (#1179). *New contract.* (Patches a coverage gap the relatedReport omitted.)

*Carved from epic #1173 under the ratified distributed placement (#1175 → B, no webdecks project); homed by its kin per the contract-inventory table.*

## Progress (batch-2026-06-20-deck)

Authored intent `interstitial-insertion` in **webintents** (`we:src/_data/intents/interstitial-insertion.json`): scheduled content insertion (pre/mid/post-roll, overlay) with `position`, `dismissal` (skippable/forced/dismissible), `resume` (resume/advance) axes. Cross-media (video ad-breaks canonical; deck interstitial, carousel promo), member of #1179; overlay composes webportals. Owns scheduling + dismissal, not the inserted content. Auto-renders at `/intents/interstitial-insertion/`.

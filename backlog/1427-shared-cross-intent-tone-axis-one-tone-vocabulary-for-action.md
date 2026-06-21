---
kind: decision
status: open
dateOpened: "2026-06-21"
tags: [webintents, tone, semantic-tone, cross-intent, placement, gap]
relatedProject: webintents
---

# Shared cross-intent tone axis? one tone vocabulary for action/badge/alert/banner vs per-intent tone (#1337 spinoff)

Spun off from the #1337 ruling, which seated an open-numbered `tone` dimension on Action Intent with an
action-scoped core of `neutral | danger` and explicitly deferred the broader question: should a **shared
cross-intent `tone` vocabulary** exist — one semantic-tone axis (`neutral | danger | success | warning |
info`) consumed by badges, alerts/banners, status indicators *and* action — versus per-intent tone
dimensions that diverge in vocabulary (the #1318/#1324 "vocabularies diverge per intent → don't flatten"
precedent that rejected a shared Emphasis Intent). The fork: shared tone axis (DRY, one color contract)
vs per-intent tone (each intent blesses only the tones that fit it; action keeps `neutral | danger`
regardless). Needs a prior-art survey (Radix `color`, Chakra `colorScheme`, Ant `status`, Bootstrap
contextual) and a prep pass before it's ready to ratify — currently `needs prep`.

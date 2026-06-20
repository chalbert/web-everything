---
type: idea
workItem: epic
status: open
size: 5
dateOpened: "2026-06-20"
relatedProject: webintents
tags: [advanceable-media, sequence, webintents, deck, video, carousel, harvest]
relatedReport: reports/2026-06-19-deck-slide-standards.md
crossRef: { url: /backlog/1173/, label: deck/slide standards epic (a consumer) }
---

# Temporal / advanceable-media sequence intent family (deck · video · carousel)

The high-leverage harvest from the deck placement decision (#1175): **deck, video player, and
carousel are one family**, sharing *advance · autoplay · "up next" · fullscreen · interstitial/ad
insertion* over a set of discrete, ordered items. Rather than re-specify those per consumer, factor the
shared **advanceable-sequence intent family** once in webintents — current/next/prev, timed advance,
up-next, present-surface — composed by all three; each adds only its layer (deck → fragments,
presenter; video → scrubbing; carousel → peek/loop). The real cross-media novel surface (not
deck-specific); [we:carousel](../src/_data/blocks/carousel.json) already owns the advance/sequence
kernel, so this generalises it.

Unsliced umbrella; slice into the member intents (advance, autoplay, up-next, interstitial, present-surface)
once the deck carve (#1173) confirms the concrete shape each consumer needs. The deck slices that
compose this family: fragment-reveal, overview, autoplay, up-next, interstitial (filed as standalone slices from the #1173 carve).

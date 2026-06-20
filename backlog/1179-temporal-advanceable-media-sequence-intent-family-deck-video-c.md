---
kind: story
status: resolved
size: 5
dateOpened: "2026-06-20"
dateStarted: "2026-06-20"
dateResolved: "2026-06-20"
graduatedTo: "intent:advanceable-sequence"
relatedProject: webintents
tags: [advanceable-media, sequence, webintents, deck, video, carousel, harvest]
relatedReport: reports/2026-06-20-backlog-split-analysis.md
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

**Single story (not an umbrella) — re-scoped 2026-06-20** (`/slice` analysis,
[we:reports/2026-06-20-backlog-split-analysis.md](../reports/2026-06-20-backlog-split-analysis.md)). The
deck carve (#1173, resolved; #1175 ratified B = fully distributed) already scattered the named member
intents as **standalone** slices that *compose* this kernel — they are downstream consumers, not children
to slice out: autoplay → #1188, up-next → #1199, interstitial → #1200, present-surface (fullscreen) →
#1198, plus deck-layer composers fragment-reveal → #1181, overview → #1187. What remains uniquely here is
the one atomic deliverable: **mint the `advanceable-sequence` kernel intent** in webintents — the
`current/next/prev` + sequence-position vocabulary and family meta-schema that
[we:carousel](../src/_data/blocks/carousel.json) owns informally today (no sequence intent exists under
[we:src/_data/intents/](../src/_data/intents/) yet — the `temporal` intent there is date/time selection,
unrelated). Re-scoped from `epic` (it had no children and was sized like a single story).

## Progress (batch-2026-06-20-deck)

Authored intent `advanceable-sequence` in **webintents** (`we:src/_data/intents/advanceable-sequence.json`): the cross-media kernel (advance · traversal · boundary · preview) that deck, video, and carousel compose, each adding only its layer. Generalises the existing carousel advance/sequence mechanics rather than re-specifying per consumer. Auto-renders at `/intents/advanceable-sequence/`. The shared family that #1181 (fragments), #1188 (timed-advance), #1199 (up-next), #1200 (interstitial) extend.

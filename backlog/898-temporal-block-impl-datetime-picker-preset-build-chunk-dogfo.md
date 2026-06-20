---
kind: story
size: 3
parent: "315"
status: resolved
blockedBy: ["736", "896"]
locus: frontierui
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: frontierui/blocks/temporal/datetimeCompose.ts
tags: []
---

# temporal block impl — datetime-picker preset + build-chunk dogfood (#713)

Wire the datetime-picker preset (composes calendar-grid + clock over `<input type=datetime-local>`) per the WE datetime-picker contract, then author the #713 build-chunk dogfood: a PRODUCTION-build assertion that a time-only fixture pulls no calendar chunk (and a date-only fixture pulls no clock chunk) — per-preset trait isolation. Capstone of the temporal IMPL track. blockedBy #736 (calendar-grid) + #896 (clock) — both chunks must exist to prove isolation, and datetime-picker composes both surfaces. Sibling slice under #315 (/slice 736). Generic cross-bundler chunk-isolation conformance is separately owned by #720/#722. Demo: green chunk-isolation test on a real build.

## Progress (resolved 2026-06-18) — locus frontierui

**Preset delivered; build-chunk dogfood carved (outgrew).** The datetime-picker preset composes the two lazy media surfaces — `calendar-grid` on a date anchor + `clock` on a time anchor — whose values compose into one `datetime-local` value:

- `fui:frontierui/blocks/temporal/datetimeCompose.ts` — pure `composeDatetimeLocal(date,time)` / `splitDatetimeLocal` value bridge (+ 4 tests).
- `frontierui/demos/datetime-picker.{html,ts}` — composes both trait-enhanced anchors, both chunks fetched on first appearance, live composed output. FUI `check:standards` green.

**Carved to [#906](/backlog/906-temporal-build-chunk-isolation-dogfood-production-build-asse/):** the #713 build-chunk dogfood (PRODUCTION-build assertion that a date-only fixture pulls no clock chunk, time-only pulls no calendar chunk). It outgrew this slice — FUI has no production-build chunk-isolation harness (the enforcer test only covers manifest generation), and it overlaps the generic cross-bundler conformance owned by #720/#722. Sized 5, locus frontierui. The composition capstone shipped; the build-assertion infra is its own item.

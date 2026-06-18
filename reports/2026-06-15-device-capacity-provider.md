# Device-capacity provider — detection-axis + composite routing prior-art survey

**Date**: 2026-06-15
**Point**: Prep research for decision #729 — surveys the device-capacity signal landscape (CPU/RAM/network/battery/GPU), the established "adaptive loading" combinator prior-art, and the per-venue availability of each signal; reshapes the item from two forks to three (adds the scalar-vs-bucket output-shape fork) and confirms the separation/composite defaults.
**Plan file**: n/a (decision-prep, not a `plans/` inbox file)
**Research page**: `/research/device-capacity-provider/`

---

## Question

Decision #729: the capability provider seam (epic #203) models **platform-feature capability**
(Baseline/web-features tiers) and picks **one** provider per scope by venue. Should WE (1) add a
**device-capacity** axis — `hardwareConcurrency`, `deviceMemory`, network/`saveData`, battery, GPU
tier — as a registered provider alongside the feature one, and (2) **combine multiple providers** so
different checks route to different sources? Delegation to existing solutions is non-negotiable: WE
standardizes the *contract + routing*, never the detection algorithm.

## Recommendation

- **Fork 1 — separate `CapacityProvider` contract** (sibling to `CapabilityProvider`, same
  registration + venue machinery), not an overload of the feature provider. High confidence — the
  separation bias + impl-is-not-a-standard, and the output shapes genuinely differ (scalar
  measurements vs. a 3-state polyfill tier).
- **Fork 2 — expose *both* the raw scalar and a derived coarse bucket** (`deviceMemory: 8` →
  `device-tier: 'high'`), not one or the other. Med-high confidence — every prior-art combinator does
  this (detect-gpu: fps → tier 0–3; Network Information: `downlink/rtt` → `effectiveType`). Raw is the
  most-permissive value (Q6); the bucket is the composable convenience.
- **Fork 3 — a `CompositeProvider` that routes by check-domain** (feature→runtime, capacity→GPU lib,
  network→edge Save-Data), satisfying the same interface so resolver + venue selection run unchanged.
  High confidence — the user explicitly asked for per-check routing; chain/fallback (redundancy) is a
  *composable* later addition, not a rival; status-quo denies the ask.

## Key Findings

### The signal landscape (delegation targets, per-venue availability)

| Signal | Native read | Edge/header equivalent | Maintained lib needed? | Venue availability |
|---|---|---|---|---|
| CPU cores | `navigator.hardwareConcurrency` | **none** (no client hint) | no (native) | runtime only |
| RAM | `navigator.deviceMemory` (bucketed 0.25–8) | `Sec-CH-Device-Memory` (Chromium) | no (native) | runtime + edge |
| Network | `navigator.connection.effectiveType/saveData/downlink/rtt` (Chromium-only JS) | `Save-Data` header (low-entropy, sent by default) | no (native) | runtime + edge |
| GPU tier | WebGL renderer benchmark | none | **yes — `detect-gpu` (pmndrs)** | runtime only |
| Battery | `navigator.getBattery()` | none | — | **excluded** |

The load-bearing new insight: **signal availability is not uniform across venues.** `hardwareConcurrency`
and GPU-tier are runtime-only (no header carries them); `deviceMemory` and `Save-Data` also resolve at
the edge. This is precisely why the capacity axis should *reuse* the existing `Venue` dimension
(`we:capabilities/venues.ts:38`) and the `undefined`-means-unknown degrade contract
(`we:capabilities/venues.ts:51` `PlatformSupport`), rather than invent a parallel resolution path — and is
an argument **for** a sibling provider on the same machinery (Fork 1 A1), not against it.

### Battery is the "exclude what's broken" case, not a fork
The Battery Status API is deprecated, removed by Firefox, never shipped by Safari, and a known
fingerprinting vector (~76% support, Chromium-only). Per the fork-existence test it is not a branch —
it is excluded as broken, with a one-line reason.

### Adaptive Loading is the established combinator prior-art
Google Chrome Labs `react-adaptive-hooks` (+ Addy Osmani's "adaptive loading" pattern, and the Svelte
`svelte-adaptive-sensors` port) combine exactly `hardwareConcurrency` + `deviceMemory` +
`effectiveType` + `saveData` to classify a device high/low-end and toggle loading. WE's "capacity
provider" is the **platform-neutral, framework-free** version of that pattern: the same four signals,
exposed through the injectable provider contract instead of React hooks. This validates the vocabulary
and the bucket-output shape (these libs all consume coarse buckets, not raw scalars, at the call site).

### Only GPU-tier needs a third-party lib
CPU/RAM/network are thin native reads; battery is excluded. The single dimension that warrants a
maintained dependency is GPU tier, where `detect-gpu` (pmndrs, the de-facto Three.js-ecosystem
standard: WebGL benchmark → tier 0–3, handles Apple's privacy-masked renderer strings) is the obvious
delegate. So "survey candidate libs" resolves to: **native APIs for three axes, `detect-gpu` for the
fourth, none for battery** — the delegation constraint is satisfied with one dependency.

## How the research reshaped the forks

The original item carried two forks (A: where the axis lives; B: how providers combine). The survey
**added Fork 2** (the output-shape question — raw scalar vs. normalized bucket), which the original
only glimpsed via A2's "`Tier` doesn't fit `deviceMemory: 8`" aside. Every prior-art combinator
normalizes to buckets *while keeping the raw value*, so this is a genuine, separable axis with a
clear default (both). This is the expected "research adds a fork" effect (#64 precedent).

## Files Created/Modified

| File | Action |
|---|---|
| `we:reports/2026-06-15-device-capacity-provider.md` | created (this report) |
| `we:src/_data/researchTopics.json` | added `device-capacity-provider` entry |
| `we:src/_includes/research-descriptions/device-capacity-provider.njk` | created (write-up) |
| `backlog/729-*.md` | rewritten to prepared-fork shape; `preparedDate` stamped |

## Sources
- [Adaptive loading — web.dev](https://web.dev/adaptive-loading-cds-2019/)
- [react-adaptive-hooks — GoogleChromeLabs](https://github.com/GoogleChromeLabs/react-adaptive-hooks/blob/master/README.md)
- [Addy Osmani — Adaptive Loading](https://addyosmani.com/blog/adaptive-loading/)
- [detect-gpu — pmndrs](https://github.com/pmndrs/detect-gpu)
- [Battery Status API — caniuse](https://caniuse.com/battery-status)
- [Navigator.getBattery() — MDN](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/getBattery)
- [Sec-CH-Device-Memory — MDN](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Sec-CH-Device-Memory)
- [Client Hints explained](https://http.dev/client-hints)

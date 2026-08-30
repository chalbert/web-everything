---
kind: decision
status: open
dateOpened: "2026-08-30"
relatedTo: ["3383", "3029", "3049", "2753"]
tags: [governance, roadmap, conveyor, constellation]
---

# The delivery machinery is meant to migrate from WE to plateau-app eventually

**Capture only — nothing ruled, no trigger, no timeline.** Recorded 2026-08-30 (operator, in-session, while
ratifying #3049): the conveyor / mechanical dispatcher / operations-engine machinery this repo is actively
building (epics #3383, #3029, #2753) is intended to move to `plateau-app` once mature — it is not meant to
live in WE permanently. Nothing in those epics' own text says this today; #3029 and #2753 both describe the
machinery's HTTP adapter being *consumed* by plateau-app's dev-panel, which is a different claim (a remote
caller) from the machinery itself relocating there.

## Why this is worth stating even half-formed

This repo's own constellation rule is that WE holds zero standard implementation — WE is standards + plugs,
Frontier UI is the implementation layer, plateau-app is the product. A large, actively-growing body of
runtime *implementation* (`we:scripts/operations/` alone: 8,095 lines as of #3049's own measurement, six days
old at the time) sitting permanently in WE is in tension with that rule on its face, even though the
machinery's current job — driving WE's own delivery — is legitimately WE's to own today. Filed now so:

- nobody designs the eventual public API, the run-store, or the tag/target system from
  [#xl43ch2](xl43ch2-generalize-delivery-mix-classification-into-an-open-admin-co.md) assuming WE is the
  machinery's permanent home;
- the eventual move is a known, named intention a future session can pick up and scope, rather than a
  surprise reframing of #3029/#2753's own architecture.

## What is NOT decided here

- **When.** No trigger is named. Plausibly gated on the same kind of signal #3049's validation gate uses (a
  real external consumer), or on plateau-app reaching some own readiness bar — not stated, not researched.
- **How much moves.** Whether this is the whole `we:scripts/operations/`+`we:scripts/conveyor/` tree, or only
  the parts a customer-facing product needs (leaving WE's own internal delivery on a lighter, WE-resident
  path), is unresearched.
- **What WE keeps.** Presumably WE keeps declaring the operations (per
  [#operations-declared-once-callers-generated](../docs/agent/platform-decisions.md#operations-declared-once-callers-generated)),
  and plateau-app would run them — but that is a guess extrapolated from the existing statute, not something
  this item establishes.

## Done when

Not applicable yet — this is a capture, not a ratified decision. Whoever next touches this should either
`/prepare` it into a real decision with a named trigger and a scoped "what moves" answer, or fold it as a
named consideration into whichever of #3383/#3029/#2753's own eventual architecture docs is the right home for
it, and resolve this card with a pointer to where it landed.

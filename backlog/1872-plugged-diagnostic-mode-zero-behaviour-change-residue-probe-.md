---
kind: story
size: 8
status: open
parent: "1836"
relatedProject: webplugs
locus: frontierui
dateOpened: "2026-06-27"
tags: [plugs, unplugged, residue, diagnostic, compatibility, dev-experience, config]
---

# Plugged diagnostic & compatibility modes: a zero-semantics-change Proxy posture family between unplugged and plugged

A config-selectable posture family between unplugged and plugged, on a pass-through Proxy over the native methods plugged mode patches (`createElement`, insertion methods) that **never changes method semantics — only observes**. Two postures: **diagnostic** logs when unowned code hits a path unplugged silently no-ops (the #1839 residue surface) — call-site, the plugged-only capability, the manual fix; **compatibility** queues an automatic `upgrade(root)` for un-upgraded roots unowned code touches, recovering *portable* capabilities without prototype patching. Only true Fork-1 residue stays unrecoverable. Postures are picked via the platform config a project extends. FUI impl under #1836.

## The spectrum

One pass-through Proxy substrate over the residue surface, four postures of increasing intervention — the invariant across all of them is **native method semantics are never altered** (that is what separates this from plugged):

1. **unplugged** *(baseline, exists)* — clean, manual `register`/`upgrade(root)`; the safe-now product surface (#606). Unowned construction silently misses.
2. **diagnostic** — install observe-only instrumentation on the residue surface. On a call unplugged can't reproduce, **warn** (call-site, which plugged-only capability, the manual fix). The degenerate observe-only case of the substrate.
3. **compatibility** — same observation, but on detecting an **un-upgraded root** touched by unowned code, **enqueue `upgrade(root)`** (batched, deduped) so the portable capabilities apply retroactively — *without* patching the method's own behavior. More like an upgrade queue than a patch.
4. **plugged** *(exists)* — full prototype patching; the only posture that reaches true residue.

## What each posture recovers — and the hard boundary

- **diagnostic** turns the silent residue *miss* into a dev-time *signal*. Pairs with the parity table (#1844): the static table says which APIs are plugged-only; diagnostic says where **this** page actually hit one.
- **compatibility** shrinks the *practical* gap between unplugged and plugged for everything that is merely *not-yet-triggered* (a 3rd-party lib builds a subtree and inserts it but never calls `upgrade()` → the Proxy notices the insertion touched an un-upgraded root → schedules the upgrade). It recovers exactly the WeakMap-portable capability set Fork 1 calls *portable*.
- **Boundary (cannot be recovered):** the true Fork-1 residue. A detached node never inserted produces **no root call to observe**, and transparent `createElement` tagging needs the value **at creation**, not at insertion — so the genuinely-missing-hook cases (`we:docs/agent/platform-decisions.md#plugged-only-residue-bar`) stay `plugged-only`. Compatibility narrows the gap to precisely that residue, no further.

## Config surface — postures are project-selected, not hardcoded

The posture is **not** baked into the tool — it is selected via the **platform config a project extends** (config-extends-platform-default). Per the three-layer carve: the posture **contract/enum** is a WE type-only schema, the **Proxy impl** is FUI, and the **selected value** ("this project wants compatibility in dev, unplugged in prod") lives in the **project config**. The platform config offers the full menu; the project picks (globally and/or per-plug — granularity is an authoring question below). All postures are dev-affordances first: compatibility and diagnostic default off in prod.

## Open authoring questions (design carried in the story, not a separate fork yet)

- **Proxy granularity:** one global native-method Proxy vs per-root instrumentation; cost/teardown.
- **Compatibility upgrade scheduling:** sync vs microtask queue; idempotency + dedup of repeated `upgrade(root)`; ordering vs the page's own mutations.
- **Per-plug vs global posture selection** in the config schema.
- **Parity-table coupling (#1844):** does compatibility move a capability's displayed state (it "works" in practice under compat)? Likely the table stays posture-neutral (states the unplugged truth) and compat is a separate column/footnote.
- **Explorer coupling (#1167):** diagnostic output as a signal source the autonomous explorer can consume.

## Lineage

Parent #1836 (make every plug public API functional unplugged). Built on the #1839 residue bar — the strict contract-portability predicate it applies **live** (`we:docs/agent/platform-decisions.md#plugged-only-residue-bar`). Relates #1844 (parity table — the static counterpart), #1167 (explorer — a consumer of diagnostic output), #1858 (unplugged ergonomics). Surfaced in discussion while ratifying #1839.

---
name: internal-spelling-not-the-proposed-standard
description: "WE's shipped authoring spelling ≠ its platform-shaped proposal; ship a collision-safe internal spelling, mark it as not-the-proposal, configurable as the bridge"
metadata: 
  node_type: memory
  type: project
  originSessionId: d0313c6f-fe00-411b-b8da-3bbcc94ba83c
---

A WE authoring spelling has **two distinct identities that must not be conflated**: (1) the *current
collision-safe internal spelling* authors type today, and (2) the *platform-shaped standard proposal*
governed by [[propose-standard-in-platform-shape]]. Pre-ratification, WE has **no namespace authority** —
it cannot mint the bare/native form a real standard would (ratifying *is* claiming the namespace) — so it
**must** disambiguate with *some* marker. The discipline: ship the marker as the internal spelling, **state
explicitly that it is NOT the proposed standard shape**, and make it **configurable** as the reconciliation
bridge to whatever the WG eventually ratifies.

Worked case — #1987 (codified `we:docs/agent/platform-decisions.md#attribute-name-colon-namespacing`):
behavior/event attribute **names** keep **colon** (`on:click`, `view:if`) as the internal spelling — colon
is collision-safe by construction (a native HTML attr name never contains `:`). This does **not** contradict
[[propose-standard-in-platform-shape]]'s "reject colon attributes": that rule governs the *proposal shape*
(the closest proposed author-attribute standard is hyphen `enh-*`, WICG#1029), and #1987 declines to chase
that **unshipped** draft while explicitly **not** claiming colon is the native shape. The separator is
app-configurable (#1992) — the bridge. If a hyphen form is ever adopted it is **`enh-*`**, **never `we-*`**:
a pure vendor prefix is the worst option (vendor-locked AND verbose), and baking a *transitional*
collision-marker into a proposed standard inverts the whole "propose in platform shape" stance.

**Why:** "most standard-shaped" can't mean "guess the final bytes" — whatever WE ships is never the WG's
final spelling anyway. So encode the **durable semantics** (a namespaced directive), not the transitional
vendor/collision artifact. The user drove this reframe (the `we-` / native / configurable questions), and a
refute-only skeptic landed a real propose-in-platform-shape hit that was absorbed by this amendment, not by
overturning the colon choice.

**How to apply:** on any WE naming/spelling call, separate "what authors type now" from "what we propose to
the platform." If you can't ship the native shape yet, pick a collision-safe internal marker, label it
not-the-proposal in the codification, prefer a real standards-track prefix (`enh-*`) over a vendor one
(`we-*`) for any future migration, and treat a config/remap capability as the migration de-risker (not an
author knob). Don't let a buried per-item ruling stand in for this — it generalizes to every spelling fork.

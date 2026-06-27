---
kind: story
size: 3
parent: "1836"
status: open
blockedBy: ["1839"]
dateOpened: "2026-06-27"
tags: []
---

> **Pre-flight (batch-2026-06-27) — re-pointed `blockedBy: ["1839"]`; build-vs-residue disposition is forked.**
> The two members can't be cleanly built now: the webregistries root `customElements` swap is **separately
> disabled and human-gated** (#1545 `humanGate: setup`, #1483), so its unplugged-drive branch is blocked on
> re-enabling that swap; and the alternative — "record them plugged-only residue" — needs the **plugged-only
> residue bar #1839 decides** (still open, Tier B ready-to-ratify). Either branch waits on #1839's ruling, so
> this is `blockedBy: ["1839"]` (was unset). Not a clean batch pickup until the residue bar lands.

# webbehaviors + webregistries unplugged members — drive defineLazy/trait-manifest and root-registry swap via the unplugged register/upgrade API, or record plugged-only

Re-audit #1840: webbehaviors defineLazy/trait-manifest is bootstrap-only (fui:plugs/bootstrap.ts:287-290, registerTraits + virtual:trait-manifest, 'Unplugged never imports this file'); webregistries root customElements swap is only exercised plugged (and is separately disabled, we:backlog/1483, we:backlog/1545). Drive both via the unplugged register/upgrade API, or record them plugged-only residue per #1839. Locus: FUI. Relates #1483/#1545. See we:reports/2026-06-27-unplugged-functional-re-audit.md.

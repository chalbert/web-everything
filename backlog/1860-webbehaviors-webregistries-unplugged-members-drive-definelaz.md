---
kind: story
size: 3
parent: "1836"
status: open
blockedBy: ["1545"]
dateOpened: "2026-06-27"
tags: []
---

> **Pre-flight (batch-2026-06-27, updated 2026-06-27 — #1839 ruling landed) — build-vs-residue disposition is forked.**
> The residue bar #1839 decides has **resolved** (`we:docs/agent/platform-decisions.md#plugged-only-residue-bar`),
> so the "record them plugged-only residue" branch is now actionable: apply the strict contract-portability bar
> and mark accordingly. The **unplugged-drive** branch still waits on the webregistries root `customElements`
> swap, which is **separately disabled and human-gated** (#1545 `humanGate: setup`, #1483) — so `blockedBy` is
> re-pointed to **#1545** (the real remaining open dependency for the build path). Pick the branch per #1839's bar.

# webbehaviors + webregistries unplugged members — drive defineLazy/trait-manifest and root-registry swap via the unplugged register/upgrade API, or record plugged-only

Re-audit #1840: webbehaviors defineLazy/trait-manifest is bootstrap-only (fui:plugs/bootstrap.ts:287-290, registerTraits + virtual:trait-manifest, 'Unplugged never imports this file'); webregistries root customElements swap is only exercised plugged (and is separately disabled, we:backlog/1483, we:backlog/1545). Drive both via the unplugged register/upgrade API, or record them plugged-only residue per #1839. Locus: FUI. Relates #1483/#1545. See we:reports/2026-06-27-unplugged-functional-re-audit.md.

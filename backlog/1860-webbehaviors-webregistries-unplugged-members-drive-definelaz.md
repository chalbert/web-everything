---
kind: story
size: 3
parent: "1836"
status: open
dateOpened: "2026-06-27"
tags: []
---

# webbehaviors + webregistries unplugged members — drive defineLazy/trait-manifest and root-registry swap via the unplugged register/upgrade API, or record plugged-only

Re-audit #1840: webbehaviors defineLazy/trait-manifest is bootstrap-only (fui:plugs/bootstrap.ts:287-290, registerTraits + virtual:trait-manifest, 'Unplugged never imports this file'); webregistries root customElements swap is only exercised plugged (and is separately disabled, we:backlog/1483, we:backlog/1545). Drive both via the unplugged register/upgrade API, or record them plugged-only residue per #1839. Locus: FUI. Relates #1483/#1545. See we:reports/2026-06-27-unplugged-functional-re-audit.md.

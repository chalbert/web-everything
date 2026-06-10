---
type: issue
workItem: task
status: open
blockedBy: ["098"]
parent: "098"
dateOpened: "2026-06-08"
tags: [licensing, cla, contributions, governance, legal, constellation]
crossRef: { url: /backlog/098-licensing-strategy/, label: "Spillover of #098 (licensing ruling)" }
---

# CLA in place before accepting any external contribution

Surfaced closing out [#098](/backlog/098-licensing-strategy/). The licensing
ruling defers everything *except* this: a Contributor License Agreement must be in
place on **Web Everything, Frontier UI, and Plateau** **before** the first outside
pull request is merged.

Unlike the rest of #098 (defer-until-launch), this one has a **near-term trigger** —
the first external contributor — and is **cheap now, expensive retroactively**: a
CLA gathered after a community forms requires re-contacting every prior contributor
to relicense, which is exactly the open-washing/relicensing pain #098 is structured
to avoid. The CLA is what preserves the relicensing optionality the gradient
depends on (Plateau's FSL tier, any future fair-source seam).

## Scope

- Pick a CLA mechanism (e.g. CLA Assistant bot on GitHub, or DCO sign-off if a
  lighter touch is preferred — decide which gives the relicensing rights the
  fair-source tiers actually need; DCO alone may be insufficient for relicensing).
- Add `CLA.md` + enforcement (bot/check) to **WE**, **FU**, and **Plateau** repos.
- Gate merges on CLA acceptance before the repos are made public / accept the first
  external PR.

## Notes

- The conformance suite (`webcases`) stays Apache permanently regardless — the CLA
  protects relicensing optionality on the platform/impl tiers, not the open funnel.
- Coordinate with #097's legal track.

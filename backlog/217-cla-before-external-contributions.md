---
kind: task
status: resolved
blockedBy: ["098"]
parent: "098"
dateOpened: "2026-06-08"
dateStarted: "2026-06-11"
dateResolved: "2026-06-11"
graduatedTo: none
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
- Add `we:CLA.md` + enforcement (bot/check) to **WE**, **FU**, and **Plateau** repos.
- Gate merges on CLA acceptance before the repos are made public / accept the first
  external PR.

## Notes

- The conformance suite (`webcases`) stays Apache permanently regardless — the CLA
  protects relicensing optionality on the platform/impl tiers, not the open funnel.
- Coordinate with #097's legal track.

## Note (2026-06-11)
The *decision* content is already settled (here and in #098): a CLA is **required on WE, FU, and Plateau before the first external PR**, it preserves the relicensing optionality the fair-source gradient needs, and `webcases` stays Apache regardless. Mechanism (CLA Assistant vs DCO) and adding `we:CLA.md` + enforcement are **execution** — this is a build task, not an open fork. Stays open as that task.

## Delivery (2026-06-11)
- **Mechanism: CLA Assistant (a real signed CLA), not DCO.** The deciding factor is
  the relicensing requirement: DCO only certifies a contributor's right to submit and
  grants **no** relicensing rights, whereas the #098 gradient (Apache → FSL Plateau →
  proprietary, plus any future FU fair-source seam) needs the Steward to hold an
  explicit right to license/relicense every contribution. The CLA's Section 2 grants
  exactly that.
- **Authored on Web Everything:** [`we:CLA.md`](../CLA.md) (Individual CLA, adapted from
  the Apache ICLA with an explicit relicensing grant) + [`we:.github/workflows/cla.yml`](../.github/workflows/cla.yml)
  (the `contributor-assistant/github-action` bot gating every PR, signatures persisted
  to a `cla-signatures` branch).
- **Cross-repo + activation deferred to [#302](/backlog/302-roll-out-the-cla-to-frontier-ui-plateau-and-activate-enforce/):**
  copying the CLA into Frontier UI + Plateau, filling the `OWNER/REPO` placeholders,
  and making the status check required are out of this batch's reach (other repos /
  pre-public ops). #302 carries the "live before the first external PR" trigger.
- `webcases` stays Apache-2.0 regardless, as the CLA itself states.

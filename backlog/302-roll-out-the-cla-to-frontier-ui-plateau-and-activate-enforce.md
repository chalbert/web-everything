---
type: idea
workItem: task
parent: "098"
status: open
blockedBy: ["217", "186"]
dateOpened: "2026-06-11"
tags: [licensing, cla, contributions, governance, constellation]
crossRef: { url: /backlog/217-cla-before-external-contributions/, label: "CLA artifacts authored in #217" }
---

# Roll out the CLA to Frontier UI + Plateau and activate enforcement

Spun out of [#217](/backlog/217-cla-before-external-contributions/). The CLA
artifacts (`CLA.md` + `.github/workflows/cla.yml`, the CLA Assistant bot) now exist
in **Web Everything**. #217 deliberately stopped at the WE artifact rather than
reach cross-repo mid-batch; this tracks the rest so the gate is **live before any
repo accepts its first external pull request** — the near-term trigger #217 names.

## Scope

- **Frontier UI + Plateau:** copy `CLA.md` + `.github/workflows/cla.yml` into both
  repos (the gradient needs the CLA on every repo that takes contributions — WE, FU,
  and Plateau per [#098](/backlog/098-licensing-strategy/)). Adjust each CLA's
  Project framing only if a repo names itself differently; the relicensing grant is
  identical across all three.
- **Activate the bot:** replace the `OWNER/REPO` placeholders in each `cla.yml`
  `path-to-document` / `custom-notsigned-prcomment` with the real repo path once the
  repos are public, and create the `cla-signatures` branch the action writes to.
- **Branch protection:** make the `CLA Assistant` status check **required** on each
  repo's default branch so a PR cannot merge until the author has signed.
- **Legal review:** confirm the CLA text (folded into the #097 legal track and the
  parked [#186](/backlog/186-legal-business-protection-review/) review) before the
  repos go public.

## Acceptance

- All three repos carry the CLA + working bot, with the status check required.
- A test PR from a non-allowlisted account is blocked until it signs, then passes.

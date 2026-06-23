---
kind: decision
size: 3
status: resolved
dateOpened: "2026-06-18"
dateResolved: "2026-06-22"
parent: "746"
relatedProject: webadapters
crossRef: { url: /backlog/1258-framework-churn-watch-keep-we-s-forward-adapters-current-as-/, label: "Watch folded into the Framework-churn watch (#1258)" }
tags: [maas, polyglot, protocol]
---

# MaaS wrapper-serve protocol — deferred experience review (collect cases, revisit framework axis)

**Resolved 2026-06-22 — folded into [#1258 framework-churn watch](/backlog/1258-framework-churn-watch-keep-we-s-forward-adapters-current-as-/).**

This item was mis-shaped: a `kind: decision` written as a *standing experience-collection home* (a Cases log + a
"how to use this item" instruction) wrapping a hidden decision — the #974 A1-vs-A2 fork — that never took its proper
form. The strict [Program Test](/backlog/1249-define-program-strictly-the-four-part-bar-for-a-perpetual-on/) makes the
conflation clear: the perpetual part (frameworks/wrappers keep needing new options) is a **currency front**, already
owned by #1258 feeding FUI's `form` catalog (#977). What was left here was a single bounded ruling, not a standing
watch — so a perpetual home was the wrong shape.

Disposition:

- **The currency watch → #1258.** Its Front-B scope now explicitly owns the MaaS serve-contract `form` catalog: file a
  `form`-catalog item when a framework gains traction (same motion as #1271), and **trip an A2-revival decision** when a
  case shows the catalog can't absorb a variation cleanly.
- **The decision itself → minted fresh on evidence, not held dormant.** The #974 **A1** ruling
  ([constellation-placement](docs/agent/platform-decisions.md#constellation-placement)) stands as the current answer
  (framework rides the catalog-gated `form` param; no new neutral contract surface). A move to a first-class neutral
  `framework` param (A2, a versioned `servePathIR` bump) is re-opened as a new `kind: decision` *if and when* #1258's
  watch surfaces a real form-catalog strain — per the discovery-output-is-cards discipline, the card is minted when the
  evidence exists, not pre-allocated as a placeholder.
- **Lineage:** provisional ruling #974 · FUI catalog #977 · serve-path preset idea #979 · watch home #1258.

No cases had accrued (the log was empty), so nothing is lost in the fold.

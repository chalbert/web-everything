---
kind: decision
status: resolved
locus: plateau-app
dateOpened: "2026-06-23"
dateStarted: "2026-06-23"
dateResolved: "2026-06-23"
codifiedIn: "docs/agent/platform-decisions.md#monetization"
graduatedTo: none
preparedDate: "2026-06-22"
relatedReport: reports/2026-06-22-1391-split-analysis.md
crossRef: { url: /backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/, label: "#1590 licensed-local-browser ruling" }
tags: [dev-browser, plateau, monetization, decision]
---

# Dev-browser in-shell free/paid line — which shell capabilities light up free vs license-gated (#141 commercial-license fork)

## Digest

Resolves the in-shell free/paid line under [#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/)
(the licensed local dev-browser as paid flagship). **Soft-accepted / revisitable** per the monetization
treatment — the *partition principle* is fixed; specific placements re-tune with usage data. The ruling is
**not** a per-capability free/paid line (the prepared "read-vs-act" map was the wrong instrument — it
paywalled *local* persist/write, which the cost-flat statute and the #775 precedent both keep **free**).
Instead the line splits into **two independent, orthogonal gates**:

1. **Commercial-use license** (the #1590 local-commercial carve-out) — covers the **whole local browser**;
   non-commercial / individual / OSS / learning = free to use *every local feature*, commercial use = paid.
   A use-context gate, **not** per-capability.
2. **Server-cost tier** (the cost-flat statute) — any capability that **requires a server to run** (hosted
   sync, hosted collaboration, hosted share-links, per-call AI) is **paid for everyone**, non-commercial
   included, as cost-recovery.

Everything local-fixed-cost is **free to use** subject only to Gate 1. The prepared "bug-capture export"
fork **dissolves**: capture + view + *local* export are free; only a *hosted* share-link is Gate-2 paid.
Unblocks the license-gating slice (`S6`) of [#1391](/backlog/1391-dev-browser-shell-build-chromium-shell-embedding-plateau-app/),
which now gates on a **license-check + server-tier check**, not per-capability flags.

## The ruling

### Gate 1 — commercial-use license (whole local browser)

The whole local dev-browser carries a **commercial-use** license (the JetBrains/Sublime model #1590
ratified, applied at the *use-context* level, not per feature). Non-commercial / individual / OSS / learning
use is **free across every local feature**; commercial use requires the license. This gate is permitted
under the cost-flat statute only because [#1590](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/)
carved out *local-commercial-license* as an explicit exception ([`we:backlog/1590-…md:44,60`](/backlog/1590-dev-surface-monetization-bet-extensions-as-funnel-vs-dev-bro/)).

**Gate-1 fork — whole-browser vs Community/Pro subset → resolved (a) whole-browser (ratified):**

- **(a) Whole-browser commercial-use license** *(ratified)* — one license covers all local features. The
  funnel is **non-commercial-free** (anyone gets the *full* browser free for non-commercial use), so no
  feature-crippled Community edition is needed to attract users. Decisive structural reason: every local
  feature is **fixed-cost**, so the statute gives **no hook to split them** feature-by-feature — a local
  Community/Pro split would re-introduce the category drift the statute forbids.
- **(b) Community (free local subset) + Pro (paid local superset)** — *Rejected.* Stronger funnel only in
  theory; non-commercial-free already *is* the funnel, and each Pro-only local feature would need a
  cost/hosting justification it doesn't have. The only legitimate per-feature line is Gate 2 (cost-based).

### Gate 2 — server-cost tier (paid for everyone)

Any capability that **requires a server to run** is **paid for all** (non-commercial included), as
cost-recovery under the cost-flat statute ([`we:docs/agent/platform-decisions.md#monetization`](docs/agent/platform-decisions.md#monetization)
rules 1 + 3). This is the *only* surviving per-capability line, and it is cost-structural, not categorical.

| Capability | Item | Gate | Why (structural) |
|---|---|---|---|
| Hosted share-link of a repro bundle | #1631 | **Gate 2 — paid for all** | requires a server to host/share |
| In-context annotation/discussion threads | #1638 | **Gate 2 — paid for all** | hosted sync of shared comments |
| Hosted semantic handoff packets (synced) | #1639 | **Gate 2 — paid for all** | hosted transfer; *local packet = free* |
| Capability-matched task queue | #1637 | **Gate 2 — paid for all** | hosted/team shared state |
| Manager-mode cross-app rollups | #141 | **Gate 2 — paid for all** | hosted aggregation across apps/teams |
| AI fix-loop (propose → verify → PR) | #141 | **Gate 2 — paid for all** | per-call LLM cost (BYO-key = free) |

### Free to use — every local fixed-cost capability (Gate-1-only)

All of these run locally at fixed cost → **free to use** for non-commercial; covered by the Gate-1 license
for commercial use. No per-feature paywall.

Live contract & data inspector (#1632), render-cause & perf inspector (#1633), explain-this-element
(#1634), ownership-aware routing (#1635), role-scoped lenses (#1636), intent/a11y conformance inspector
(#1642), variant simulator (#1643), permission/identity simulator (#1645), semantic search (#1651),
jump-to-source (#1652), state & action explorer (#141), in-context test status (#141),
business-rules-in-context (#141), **local repro capture + view + local export** (#1631), **local handoff
packets** (#1639), **safe-edit sandbox → PR** (#1650, local git emit), **branch & run diff** (#1649,
local), **scenario/fixture + named-seed loaders** (#1646/#1647, local), **failure & network injector**
(#1644, local). Standard-aware review assistant (#1640) and rule→coverage gap surfacer (#1641): **free to
use** as local read-and-suggest; only a *hosted* PR-open path would hit Gate 2.

## Why the prepared "read-vs-act" map was wrong

The prepared default added a third paid trigger — *persist a shared artifact / write back to source /
scale* — that the cost-flat statute does **not** have (its only triggers are **per-call cost** and
**hosted/credential-holding**). #775 Fork 1 ratified exactly this: *"deterministic + **local** = free;
per-call cost OR **hosted**/collab/managed = paid"* ([`we:backlog/775-…md:49`](/backlog/775-design-system-creator-assembler-open-core-layering-simple-fu/)),
with **cloud** persist/share — not local persist — as the paid trigger ([`we:backlog/775-…md:35`](/backlog/775-design-system-creator-assembler-open-core-layering-simple-fu/)).
Local export, local fixtures, and local safe-edit→PR are fixed-cost → **free**; only the *server-backed*
variants are paid. The read-vs-act framing over-reached; the two-gate model is the faithful composition.

## Context

Carved from the [#1391 split analysis](reports/2026-06-22-1391-split-analysis.md) as one of the two forks
blocking the dev-browser shell epic (the other is the panel-embed boundary, [#1654](/backlog/1654-dev-browser-panel-embed-boundary-package-import-vs-iframe-we/)).
The conformance-depth lighting gate (#141 Fork 1, ratified) is **orthogonal** and unaffected — it decides
*whether a capability is available at all*; this decides *which available capabilities are free vs paid*.
Tiering numbers (price, seat model) stay deferred to first-sale per #141 Fork 3. Resolution unblocks slice
`S6` of #1391: it implements a **commercial-use license check + a server-tier check**, not a per-capability
free/paid flag table.

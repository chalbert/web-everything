---
kind: story
size: 8
parent: "554"
status: open
humanGate: { kind: setup, what: "The operated/hosted tier (plateau-app Phase 2/3) is gated on the #554 SaaS-phase go/no-go — a founder decision to enter the SaaS phase and provision hosting/accounts. Its slice deps (#558/#559/#560) are resolved; what remains is out-of-phase behind the defer-live-serve roadmap, not agent-buildable until the operated tier is on the roadmap." }
dateOpened: "2026-06-14"
dateParked: "2026-06-14"
tags: [auto-update, runner, plateau-app, hosted, dashboard, live-serve, parked, out-of-phase]
---

# Auto-update operated runner surface + dashboard (plateau-app, hosted tier)

Slice 4 of the #497 ruling (Fork 1 → A — the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement) rule) — the open-core hosted/operated tier: a plateau-app surface + dashboard over the auto-update runner (status of in-flight updates, gate verdicts, rollout/rollback state, failed-update triage). OUT-OF-PHASE / PARKED at creation: this is plateau-app Phase 2/3 (backend-backed, operated), which parks under #554 behind the defer-live-serve strategy — sliced now only so the hosted tier has a citable home, not to build before live-serve is on the roadmap. Blocked by slices 1-3 (#558/#559/#560) and, by phase, the live-serve roadmap. Per #497 Ruling and slice plan; plateau:plateau-app/CLAUDE.md 'THE PHASE RULE'.

> **PARKED at creation 2026-06-14 — out of phase, not active work.** This is the backend-backed operated
> tier (plateau-app Phase 2/3). It stays parked behind the defer-live-serve strategy and under #554.
> **Unpark when** slices 1–3 are built *and* running a deployed Plateau SaaS is on the roadmap.

## Done when

**No tier-1 criterion, and here is why.** This item is **parked out-of-phase behind a human gate** — the
`humanGate: { kind: setup }` in its frontmatter records that the operated/hosted tier is gated on the #554
SaaS-phase go/no-go, a founder decision plus provisioned hosting. There is no code to write and nothing to run
until that gate opens, and it also lands in `plateau:`, not this repo, so nothing here can fail-before /
pass-after. Criteria are therefore an **unpark condition** (tier 2, one read each) plus the shape the eventual
build must take — deliberately not a build plan, which would be the "started early" mistake the park exists to
prevent.

**Unpark condition — both halves, checked cheaply:**

- Slices 1–3 are done: `grep -m1 "^status:"` over `we:backlog/558-*`, `we:backlog/559-*` and
  `we:backlog/560-*` each reads `resolved`. **Already true as of 2026-08-21** — this half of the block-quote
  above is satisfied.
- The phase gate is open: `we:backlog/554-plateau-hosted-saas-product-suite-shell-multi-product-accoun.md`
  reads `resolved` (today: `open`), i.e. running a deployed Plateau SaaS is on the roadmap. **This is the half
  that still holds the park**, and it is a founder call — not agent-buildable.

**When it unparks, done means:**

- The `humanGate` block is removed and `dateParked` cleared in the same edit that flips the item to `active` —
  a parked item that starts being worked while still carrying its gate is how out-of-phase work leaks in.
- The surface covers the four states the digest names — status of in-flight updates, gate verdicts,
  rollout/rollback state, failed-update triage — each backed by a real runner signal, not a mock.
- It lands in `plateau:` per the [constellation-placement](docs/agent/platform-decisions.md#constellation-placement)
  rule the #497 ruling applied (Fork 1 → A), so its acceptance criteria are authored and proven **in that repo**,
  not here. Re-author them at unpark against the runner that actually exists then; anything written now would be
  stale by the time the gate opens.

## Independent review — 2026-08-21

Confidence: **High**

**Risks assessed** (per we:backlog/3103-*.md's taxonomy):

- **premise** (addressed; strategy: verify by mutation or reversion BEFORE building) — Card's two load-bearing claims re-verified against we:backlog/558-*, we:backlog/559-*, we:backlog/560-* (all status: resolved) and we:backlog/554-plateau-hosted-saas-product-suite-shell-multi-product-accoun.md (status: open) — both match the card's stated grep results exactly as of 2026-08-21.
- **decorative-guard** (addressed; strategy: mutate the guarded line; require a NAMED test to redden) — The card's actual hold mechanism is `humanGate: { kind: setup }` (present in we:backlog/561-*.md frontmatter, not just prose). Confirmed live in we:scripts/check-standards.mjs (lines ~601-624: validates humanGate shape, warns if a humanGate item's status isn't 'open', and surfaces it as 'Held — awaiting a human action') and we:scripts/check-readiness.mjs (line 330: filters `status==='open' && humanGate` into a distinct Held section, separate from Tier A ready items). The gate is real and demotes the item out of the ready pool, not decorative.
- **legibility** (addressed; strategy: assert the failure SURFACES, not just that it occurs) — we:scripts/check-readiness.mjs explicitly prints humanGate-held items under a labeled 'Held — awaiting a human action' section rather than silently dropping them, and we:scripts/check-standards.mjs warns if the humanGate's `what` text or status ever drifts — the park state surfaces rather than failing silently.

**Corrections recommended:**

- none — the preparation held up as written.

The card's every checkable claim (slice statuses, #554 status, the constellation-placement anchor, the humanGate schema, the tier-2 acceptance-ladder usage, and its parent-epic assignment to #554) re-verifies cleanly against the live repo, and the park mechanism it relies on is a real, non-decorative, legible gate — this is a well-prepared, internally consistent park record with nothing that survives scrutiny as a defect.

_Recorded through the declared `review-prep` operation._

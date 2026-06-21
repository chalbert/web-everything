---
kind: epic
parent: "099"
status: open
ongoing: true
dateOpened: "2026-06-06"
tags: [roadmap, mvp, go-to-market, strategy, emergent, monetization, solo-founder, product]
crossRef: { url: /backlog/089-monetization-product-ideas/, label: "Product ideas (#089)" }
---

# Emergent MVP strategy

> **Reopened 2026-06-20 (`ongoing: true`).** Resolving this 2026-06-15 was premature — it is a *living strategy doc* for a perpetual, emergent process, not a finite deliverable. It legitimately sits `open` with all child slices resolved between rounds; the next candidate/round is added as the strategy advances.

The path from "ideas catalogued" to **one shipped, paying product**, run by a
single person. The earlier framing tried to *pick* the first product up front;
the resolved approach is the opposite: **the product is too in flux to commit a
scope to now, so we work as many candidate ideas as we can in parallel and let
the MVP emerge** from what proves out. This item is the **living strategy doc**
for that — not an authoritative product spec.

Two things were decoupled to make this work:

- **Product candidates** (this epic) — worked in parallel, each as its own MVP
  with its own growth path. The list below is a **menu, not a commitment.**
- **Commercialization infrastructure** ([#181](/backlog/181-commercialization-infrastructure/))
  — auth/licensing, payments, marketing site, marketing strategy, legal. This is
  **product-agnostic scaffolding** and is tracked in its own epic so it isn't
  tangled into any single product's roadmap. Sequencing is still governed by the
  solo-founder lens in [#089](/backlog/089-monetization-product-ideas/):
  **lowest operational burden first** (tier-1 self-run tools, bring-your-own-AI).

## Keep this updated — it's a living doc, not a one-time decision

Because the MVP *emerges*, this strategy must track reality:

- **When you work a product candidate, update this item** — note what's proving
  out, what isn't, and how the picture of "the MVP" is converging. The emerging
  MVP is whatever the worked candidates are pointing at, recorded here.
- Treat the candidate list as **non-authoritative**: add, drop, or re-rank
  candidates as the work teaches us. Don't gate a candidate on this doc; gate the
  doc on the candidates.

## Product candidates (a menu — non-authoritative)

All share ~80% of one engine: *input adapter → neutral structure →
verify-gated generation*. Build each as an adapter on the shared `webadapters`
core; the **verify gate** (round-trip + `check:standards` before any artifact is
offered) is the trust spine and the moat, identical across all of them.

- **AI upgrader** ([#094](/backlog/094-ai-upgrader-tools/)) — *MVP shipped (2026-06-08).*
  Foreign/legacy code → conformant output. Clearest enterprise pain + bounded
  model variance (structured input). The shared engine is now **real**: input
  adapter → neutral `ComponentIR` → **verify-gated** generation, AI analyzer
  behind a swappable registry with a deterministic no-key reference provider
  proving the seam. Generation reuses the existing MaaS `serve()` core (no
  parallel generator); the verify gate (parse + fidelity round-trip + intent
  conformance) is the **propose-and-verify moat**, shared across the whole
  candidate menu. Live playground + 16 unit tests. **This is the emerging MVP
  spine** — the other candidates plug their input adapter onto this same engine.
  Growth: BYO-AI provider ([#188](/backlog/188-upgrader-byo-ai-model-analyzer/)),
  intent inference ([#189](/backlog/189-upgrader-intent-inference/)), more input
  adapters ([#190](/backlog/190-upgrader-additional-input-adapters/)), version
  codemods ([#191](/backlog/191-upgrader-version-migration-codemods/)).
- **Conformance auto-fix agent** ([#095](/backlog/095-conformance-auto-fix-agent/))
  — *being worked.* Fix violations against the checker; tightest verify loop,
  lowest model risk. Effectively the upgrader's narrowest input case — folds onto
  the same engine. Its own MVP, large room to grow.
- **Mockup → code** ([#086](/backlog/086-mockup-to-standard-code-tool/)) —
  **deferred post-MVP.** Best marketing "wow," but open-ended visual input =
  highest model variance and a bigger/riskier build; not needed to prove the
  engine or make a first sale. Add later on the same engine as a funnel demo.

## Sequencing note

Everything here stays **tier-1**: self-run tools, BYO-AI, no model cost / uptime
/ SLA. The bigger always-on plays (MaaS live CDN #081, business-rule/compliance
manager #093, the relationship-graph dashboard #092) are **post-MVP** — they add
uptime/contract burden and wait until a self-run tool funds taking that on. The
one tiny always-on surface (the license endpoint) lives in the infra epic
([#181](/backlog/181-commercialization-infrastructure/)), not here.

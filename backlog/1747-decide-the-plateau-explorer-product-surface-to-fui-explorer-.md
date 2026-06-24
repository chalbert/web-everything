---
kind: decision
status: resolved
dateOpened: "2026-06-24"
dateStarted: "2026-06-24"
dateResolved: "2026-06-24"
graduatedTo: none
preparedDate: "2026-06-24"
relatedProject: webcomponents
relatedReport: reports/2026-06-24-cross-repo-tool-engine-product-boundary.md
codifiedIn: docs/agent/platform-decisions.md#devtools-placement
tags: [explorer, devtools-placement, constellation, plateau, frontierui, monetization, output-contract]
---

# Decide the explorer's home: a Plateau product (closed); WE holds only the result/output-format contract

## Digest

The autonomous explorer is a **Plateau-owned product, closed-source** — engine, CLI, oracles, harnesses,
report-bundling, all of it. It is **not** "FUI's engine"; the prepared split (engine→FUI, chrome→Plateau) is
withdrawn and **both its forks dissolve**. The **only** Web Everything artifact is a **result/output-format
contract** (a finding/report interchange schema) so any other tool can consume explorer output. Free vs paid
follows the assembler model (cost/hosting line; local oracles free, the per-call VLM judge paid).
Open-sourcing later stays Plateau's option, not a fork to settle now. Confidence med-high.

## Decision (2026-06-24)

The explorer is a **closed Plateau product**. The whole tool relocates to plateau-app; FUI keeps no copy. WE
mints **one** thing — the explorer **result/output-format contract** — and nothing else.

## Why a product, not the standard or the reference impl

- **Open-core draws one line:** the **standard (WE)** and the **reference implementation (FUI)** are the open
  giveaway that drives adoption; **products** are closed/paid. The explorer is neither the standard nor a
  reference impl of it — it is a **developer-operated surface you run against your own build**, which is
  exactly `we:docs/agent/platform-decisions.md` rule-1's positive test for → Plateau, and the same class as
  the assembler / configurator / dev-browser (already Plateau products).
- **FUI does not need it** (verified 2026-06-24). Every engine file imports only `@playwright/test` + its own
  `fui:tools/explorer/*` siblings — **zero imports of FUI component source**; nothing in FUI outside
  `fui:tools/explorer/` imports it. It is a **point-it-at-a-URL analyzer**: FUI is merely one *subject* (and
  the incidental current host, via the `explore` / `explore:gate` dogfood scripts in `fui:package.json`), not
  a consumer. There is no FUI→engine dependency to preserve.
- **Generic-ness cuts toward closed, not open.** Because it tests *any* app, not only WE apps, it has a market
  beyond the ecosystem — product value, not adoption bait. "Generic" never implied "open."

## What WE keeps: the result/output-format contract

The lone standard-layer artifact is a **finding/report interchange schema** — severity, location, oracle id,
evidence, run/coverage summary — plus an open extension slot. Rationale: per `we:docs/agent/platform-decisions.md`
(#1467) WE keeps the *contract*, not the engine; and the temporal rule is already satisfied by **convergent
external prior art** for tool-result interchange (SARIF, axe-core JSON, Lighthouse JSON), so mint the core
schema now + an extension slot rather than waiting on a second impl. This lets third-party tools and CI consume
explorer output without depending on the closed product. (Distinct from the already-resolved **conformance**
binding interface in WE, #1596 — a different engine; that distinction is this card's original finding.)

## The two prepared forks dissolve

- **Fork 1 — cross-repo consumption boundary:** *moot.* It existed only because the prep assumed the engine
  stays in FUI while the chrome moves, creating a Plateau→FUI seam. The whole explorer lives in Plateau and
  imports nothing from FUI (it drives subjects over a browser), so there is **no** `@frontierui` public API to
  stand up.
- **Fork 2 — Layer-1 `fui:tools/explorer/oracles/genericInvariants.ts` home:** *moot.* It travels to Plateau
  with the engine it is internal to; no FUI-vs-shared-lib question remains.

## Consequences (on ratify)

- **Re-scope `we:backlog/1577`** — from "relocate CLI chrome / orchestration / report-bundling" to "relocate
  the **whole** explorer (engine included) FUI → Plateau." The engine moves too; FUI dogfoods by running the
  Plateau tool against its dev server.
- **Supersede `we:backlog/1763`** (extract engine to a neutral *open* package) — withdrawn: the whole tool
  goes to *closed* Plateau, not an open package. Resolve as superseded.
- **New WE slice** — scaffold a foundational contract card: "Explorer result/output-format interchange schema
  (+ extension slot)", the one WE artifact this decision mints.
- **Amend `we:docs/agent/platform-decisions.md`** devtools-placement: the autonomous explorer's **engine**
  (not just its chrome) → Plateau, and WE additionally holds the explorer **output-format contract**. This
  re-points the residual #1565 Fork 3 left open.

## Red-team

The flip from the prepared "engine→FUI split" clears the merit gate: the explorer is a run-against-your-own-build
**product** (rule-1 positive test → Plateau), not the standard's implementer-agnostic verifier — that is the
*conformance* engine, already interface→WE (#1596), and this card's founding finding is that the two are
different engines. "Engine stays in FUI" rested on FUI *needing* it, which is refuted (point-at-URL, zero FUI
imports). "WE holds only the contract" respects #1467 + the temporal rule (convergent prior art: SARIF / axe /
Lighthouse). No principle is violated by homing closed-product code in Plateau. Residual that is genuinely the
founder's, not this card's: whether a future free tier is *open-source* or merely *free-to-use* — deferred,
Plateau can open-source later if needed.

## Lineage

#1577 is `blockedBy` this. Surfaced during batch-2026-06-23-1725-1665 working #1577. Grounds: #1565 Fork 3 +
`we:docs/agent/platform-decisions.md` rule 1/3 (#1467 contract-in-WE; #475 vision→Plateau), the
assembler-is-Plateau-with-both-tiers precedent (#775), the verified point-at-URL / zero-FUI-import nature of the
engine, and open-core monetization (#089–#093). Report:
`we:reports/2026-06-24-cross-repo-tool-engine-product-boundary.md`. Supersedes the prep's split recommendation
and #1763.

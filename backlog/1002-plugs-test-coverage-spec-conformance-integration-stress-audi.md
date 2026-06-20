---
kind: epic
status: resolved
dateOpened: "2026-06-19"
dateResolved: "2026-06-19"
graduatedTo: none
tags: []
---

# Plugs test-coverage, spec-conformance & integration stress audit

> **Umbrella epic** — partially sliced 2026-06-18 (`/slice 1002`). Three groundable slices cut now:
> **#1009** (testing-strategy doc + WE-mirror coverage **measurement** — foundational), **#1010**
> (webvalidation to the bar, both mirrors — the named priority slice), **#1011** (#960-class
> patch-interaction stress harness). The remaining **~9 per-plug coverage+e2e slices** are deliberately
> **not** pre-cut: their precise scope is unknown until #1009's WE-mirror measurement lands (the FUI
> snapshot below is stale for the WE side — e.g. webvalidation shows 6 WE unit test files vs the "0"
> here). **Re-run `/slice 1002` after #1009 lands** to cut the per-plug wave against measured gaps. See
> `we:reports/2026-06-18-backlog-split-analysis.md`.

Quality epic to bring **all 11** plug domains (webcomponents, webexpressions, webinjectors, webcontexts,
webstates, webbehaviors, webguards, webvalidation, webregistries, webdirectives, core) to full test
coverage — **plugged AND unplugged**. The lens is **e2e + integration depth**, not the coverage-% number:
prove each plug conforms to its spec/contract and survives the seams where patches interact (the #960
class — one patch dropping `Node.TEXT_NODE` silently broke every DOM consumer). Deliverables: per-plug
coverage to a defined bar, a thorough e2e/integration review of each domain, and a written
**testing-strategy reference doc**. Slices per-plug and per-dimension.

## Goal

Today plug testing is uneven and the *number* hides the real risk. The unit/coverage % says little about
whether a plug (a) conforms to its spec/contract and (b) survives **integration** — multiple patches
applied together, plugged vs unplugged, in a real browser. #960 is the cautionary tale: the
`webinjectors` patch replaced global `Node` and dropped its static constants; every `x.nodeType ===
Node.TEXT_NODE` guard silently flipped, breaking Parchment/Quill (and any DOM library) — and **no test
caught it**. This epic makes plug correctness *provable*, not incidental.

## Workstreams (the slices)

**A. Full coverage — every plug, plugged + unplugged.** Raise each of the 11 domains to a defined bar
for both modes. Today only 3 of 11 (`fui:plugs/webcomponents`, `fui:plugs/webregistries`,
`fui:plugs/webinjectors`) have a dedicated per-plug unplugged unit test; the rest lean on the shared
`fui:plugs/__tests__/unplugged.test.ts` suite. Coverage % is a *signal*, not the target — but the raw
zeroes below must go.

**B. E2e + integration depth review (the priority lens).** For each plug, audit the real-browser e2e:
is the plugged behavior actually exercised through `fui:plugs/bootstrap.ts`, or only asserted in
happy-dom? Several plugs have rich unit tests but thin/absent e2e (webvalidation, webguards,
webdirectives have **no dedicated** `we:plugs/__tests__/e2e/` spec). Add the missing e2e lanes and
deepen the integration scenarios — patches composed, not tested in isolation.

**C. Integration / patch-interaction stress.** Explicitly test the seams where one plug's patch can
corrupt global invariants other plugs/libraries depend on (the #960 class). At minimum: assert the
`Node.*` static constants survive every patch; assert third-party DOM libraries still instantiate under
the full plugged bootstrap; assert plugged↔unplugged parity where a behavior should be identical.

**D. Testing-strategy reference doc.** Author a durable reference (proposed home
`we:docs/agent/plugs-testing-strategy.md`) that codifies: the unit (happy-dom) vs e2e (real browser)
layering; what "plugged" vs "unplugged" each layer must cover; the per-plug coverage bar; the
integration/stress expectations (patch-interaction invariants); and the checklist a new plug must satisfy
before it ships. This is the artifact that keeps the epic's gains from eroding.

## Current state — snapshot 2026-06-19 (measured on the `frontierui` mirror)

Unit (happy-dom) line coverage, per plug — *the WE-canonical mirror (`we:plugs/`) needs its own
measurement as part of workstream A (plugs are duplicated per #170/#649):*

| plug | unit % lines | dedicated e2e specs | raw gap |
|---|---|---|---|
| webstates | 100 | 4 | — |
| webdirectives | 100 | 0 | no e2e |
| webguards | 100 | 0 | no e2e |
| webbehaviors | 96 | 3 | `parsers/` subdir 0% |
| webregistries | 93 | 2 | — |
| core | 88 | (via full-stack) | — |
| webinjectors | 81 | 3 | `fui:plugs/webinjectors/NativeInjector.ts` 0% |
| webcontexts | 80 | 3 | — |
| webcomponents | 57 | 3 | unit low (e2e-heavy) |
| webexpressions | 57 | 1 (text-interpolation) | unit low (e2e-heavy) |
| **webvalidation** | **0** | **0** | **no unit tests, no dedicated e2e** |

Unplugged: a shared suite exists (`fui:plugs/unplugged.ts` entry +
`fui:plugs/__tests__/unplugged.integration.test.ts` + two unplugged demos), but only 3/11 plugs have a
per-plug unplugged unit test.

## Slicing

Natural children: one per-plug slice (coverage + spec-conformance + e2e/integration for that domain), or
one per-dimension slice (A/B/C across all plugs), plus D (the strategy doc) authored early so the slices
target a defined bar. **webvalidation is the highest-priority first slice** (0/0). Slice when claimed —
don't pre-decompose.

## Related

- **#960** — the integration bug that motivates workstream C (`webinjectors` Node-statics regression).
- **#229** — existing webcomponents e2e bug (`we:webcomponents.spec.ts` about:blank origin); fold into
  workstream B for webcomponents.
- **#170 / #649** — plugs are duplicated across `we:plugs/` and `fui:plugs/`; coverage work must land in
  both (or follow the reconcile).
- **#725** — port WE-only plug domains (webguards/webvalidation); coordinate so webvalidation coverage
  isn't built twice.
- **#168** — plateau in-browser test harness (the runtime-only behavior harness this can lean on).

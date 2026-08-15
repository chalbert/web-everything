---
bornAs: xcif8yh
kind: decision
parent: "142"
status: open
locus: plateau-app
dateOpened: "2026-08-15"
preparedDate: "2026-08-15"
crossRef: { url: /backlog/1694-in-browser-standard-aware-review-lens-dev-browser/, label: "#1694 blocked on this fork" }
relatedTo: ["1640", "1689", "1693", "1694"]
tags: [dev-browser, review-assistant, conformance, decision]
---

# Declared-conformance drift signal for the standard-aware review assistant (#1640 slices)

Names the fork #1693 and #1694 both left as under-specified prose: what live/diff signal proves a declared rule (#1689 DeclaredRuleRegistry) is violated, and how a judging binding is produced per-app. Blocks #1694 (and #1693) from a decided design.

## Why this is the real blocker, not "no consumer"

#1693 (Slice A, the diff-aware CI gate) was parked 2026-06-23 with `parkedReason: maturityGated`,
`maturityTrigger: externalConsumers>=1`, on the reasoning "no app declares any rules... the gate has a
zero-rule input set." #1694 (Slice B, this live in-browser lens) inherited the same block via
`blockedBy: ["1693"]` for the identical reason.

That reasoning is now governance-questionable: `we:docs/agent/backlog-workflow.md` ("No consumer yet is not a
hold", added 2026-06-28, commit `8e2f5197`, five days *after* #1693/#1694 were parked) **bans "no
production consumer" as a standalone defer reason once a mechanism's contract is codified** — "a
vitest/unit fixture that encodes that contract is a valid consumer; author it test-first." #1689 (the
`DeclaredRuleRegistry` + linkage/coverage) **is** codified and resolved
(`plateau:packages/dev-browser/src/declared-rules/{registry,types,index}.ts`), so "wait for a real app" is
no longer, by itself, a legitimate reason to leave #1694 blocked.

Re-verified live in `plateau-app` (2026-08-15) that the underlying fact is still true — zero real consumers
exist:
- `registry.register(` fires nowhere outside a test fixture
  (`plateau:packages/dev-browser/src/element-resolver/element-resolver.test.ts:52` is the only call site).
- No app declares a `CapabilityManifest` at conformance level `L1` — `grep -rn "conformanceLevel"` across
  `plateau-app` returns hits only inside the `feature-lighting` gate module itself
  (`plateau:packages/dev-browser/src/feature-lighting/{light,types}.ts`), never from a consuming app. The
  `declared-rules` dev-browser module is gated at `L1` with no extra features
  (`plateau:packages/dev-browser/src/feature-lighting/light.ts:96-99`), so it has never unlocked for any
  real app either.

But **the fixture-is-a-consumer rule only closes half the gap.** A fixture can stand in for "a real app
declares rules" — it cannot stand in for a **judging algorithm that has never been specified.** That
algorithm, not the missing consumer, is what should actually block #1694.

## The proven delivery pattern (so this isn't blocked on a UI shell either)

It's worth naming what does **not** block #1694, because two other candidate blockers turned out to be
red herrings on inspection:

- **Not the Electron dev-browser shell** (`#1391`, `blockedBy: ["2342"]`; its foundational scaffold `#1753`
  carries a `humanGate: setup` for adding Electron and boot-verifying a windowed GUI — several layers away).
- **Not the Chrome DevTools-panel extension** (`#1656` lineage) — its only wired content today is a
  conformance-detected/not status slot (`#2210`,
  `plateau:packages/extensions/src/chrome-extension/panel.js`); no capability-module panel has ever been
  wired into it.

The sibling "live dev-browser surface" stories opened the same day as #1694 (#1695, #1696, #1697 — all
`parent: "142"`) establish the actual pattern this cluster uses, and **#1696 proves it works**: it shipped
(resolved 2026-07-26) as a **plain, self-contained, framework-free DOM panel** —
`plateau:packages/dev-browser/src/scenario-loader/panel.ts`'s `mountScenarioLoader(root, library, options)`
— "cheap to mount anywhere a WE app runs," verified by a Playwright spec
(`plateau:tests/e2e/scenario-loader-roundtrip.spec.ts`) that mounts a tiny synthetic app-under-test plus the
panel and drives the round-trip through real DOM clicks. No Electron shell, no extension host, no real
production app required. #1694 should follow the identical shape — `mountDeclaredRuleLens(root, registry,
appId, ...)` — once the judging half below is decided.

## What's actually undecided: the judging half

#1693's own pre-flight named this in June and it is still true in August: *"the 'conformance drift'
predicate is also under-specified... it would force inventing a per-app rule-declaration convention no one
uses."* Concretely: `DeclaredRule` (`plateau:packages/dev-browser/src/declared-rules/types.ts:35-56`) pairs
a rule to `vectorIds` or a `contract`+`tier` join — it carries **no executable check**. To flag "drift" you
need to actually *run* something and observe pass/fail. The nearest existing machinery that runs a
conformance vector and judges the result is real and proven:

- `ConformanceVectorOracle` / `runConformanceVector` / `judgeConformanceTrace`
  (`plateau:packages/core/src/conformance-engine/conformanceVectors.ts:74-306`) drives a
  `ConformanceVectorSuite` against a `SynchronousConformanceBinding` and returns `Finding[]` — this is a
  working, tested, live-in-browser judge (proven by `plateau:packages/core/src/conformance-engine/conformanceEmbed.ts`'s iframe, which renders per-vector
  pass/fail from exactly this call chain).

But every existing binding factory (`plateau:packages/core/src/conformance-engine/embedSuites.ts:41-63`) is
hand-authored **per WE-owned framework-level standard** (webpolicy, webtheme, intl, analytics, reliability,
webprocess) against a **relocated FUI engine** — proving "does FUI's engine conform to WE's vector corpus,"
not "does *this example app's currently-rendered component* obey the rule it declared." Nothing today
produces a `SynchronousConformanceBinding` generically, on demand, from an arbitrary live app's mounted DOM.

## The fork

**Option A — reuse the vector/binding engine; the app supplies a binding per declared rule.** An app
declaring a rule also registers a small adapter (`dispatch`/`observe` over its own DOM/state) that lets
`ConformanceVectorOracle` drive the rule's linked vector against the live instance. Reuses the exact judging
code the framework-level standards already trust (temporal steps, `neverObserved`, per-key matchers); the
cost falls on the declaring app, which must author a binding — real but bounded authoring work, mirroring
how each framework-level standard already does this once per implementer.

**Option B — a lighter, declared-rule-native predicate.** Add an optional executable check directly to
`DeclaredRule` (e.g. a `liveCheck(scopeEl): Finding[]` the app supplies at registration), decoupled from the
vector/binding/clock apparatus entirely. Simpler to author for a one-off app rule and needs no temporal
machinery for a human-driven live view (there's no "steps" to dispatch — the panel checks *right now*, on
demand or on mutation). Trade-off: it's a second judging mechanism alongside the vector engine, so WE's
"one conformance ground truth" story forks into two paths that could drift from each other.

**Recommendation: (B) for #1694 specifically, confidence Medium.** The live in-browser lens is inherently a
point-in-time, human-driven check ("as you view a change") — it has no natural "steps" to replay, so the
vector engine's temporal-trace machinery (built for scripted, timed conformance runs) is overhead this slice
doesn't need. #1693 (the diff-aware CI gate, still separately parked) is the better fit for Option A, since a
CI run already has a controlled render to drive through the full vector replay. Splitting the two slices
onto different mechanisms is not free — it duplicates judging logic — so before ratifying, weigh whether
Option A generalized well enough (e.g. a synchronous-only binding, no clock, is already a supported shape
per `plateau:packages/core/src/conformance-engine/conformanceVectors.ts:76` `SynchronousConformanceBinding`)
that both slices could share it with acceptable authoring cost. That comparison is the actual work of
ratifying this fork — flagged, not resolved, here.

## Un-gates

Ratifying either option (or a scoped variant) restores #1694 to a preparable state: with the judging half
named, #1694's own prep can write the `mountDeclaredRuleLens` interface, a fixture-registry `## Done when`
list, and ordered tasks — the same shape #1696 shipped. #1693 benefits identically for its diff-aware gate.

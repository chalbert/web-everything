---
kind: decision
status: resolved
locus: webeverything
dateOpened: "2026-06-29"
dateStarted: "2026-07-02"
dateResolved: "2026-07-02"
graduatedTo: none
preparedDate: "2026-06-29"
codifiedIn: "docs/agent/block-standard.md#transient-exposed-api"
relatedReport: reports/2026-06-29-we-fui-chip-upgrade-listener-contract.md
tags: [webcomponents, fui-boundary, filter-chip, transient-element, decision]
---

# WE↔FUI chip-upgrade listener contract: codify the consumer rule (both original forks dissolved)

A FUI `<we-filter-chip>` is a transient custom element (the `TransientElement` self-replacement pattern,
[we:block-standard.md:243](../docs/agent/block-standard.md#L243), family **(A)**): on upgrade it **replaces
itself with a native `<button class="fui-filter-chip">`** ([fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts)
`queueMicrotask(() => this.replaceWith(el))`), and the original element — with any listeners bound directly
to it — is detached and discarded. WE-side JS that wires those chips loses any handler it attached *before*
the upgrade, and any cached element reference goes stale. This shipped twice as a regression on the
`/backlog/` Prioritisation table; the summary count pills (`data-pfilter`) used direct `addEventListener` and
silently stopped filtering the moment the FUI module loaded.

## Grounding digest (from prep — [relatedReport](../reports/2026-06-29-we-fui-chip-upgrade-listener-contract.md))

- **Only the *host* element's own listeners are lost.** The base **moves** child nodes
  ([fui:blocks/transient/TransientElement.ts](../../frontierui/blocks/transient/TransientElement.ts), lines
  ~67–68) so listeners on *children* survive; `decorate`
  ([fui:blocks/filter-chip/FilterChipElement.ts](../../frontierui/blocks/filter-chip/FilterChipElement.ts)
  lines 56–84) **copies every attribute** onto the native button (so `data-pfilter`/`data-pready` and a
  computed `aria-pressed` **survive the upgrade**). The DOM exposes **no API to enumerate/transfer an
  element's own listeners** — so a "preserve the bound handlers" fix is *mechanically impossible*.
- **The fix already shipped and is regression-netted.** [we:src/assets/js/backlog-table-sort.js:198-235](../src/assets/js/backlog-table-sort.js#L198)
  delegates on `document` and live-re-queries for *every* chip class; the deterministic interaction lane
  [we:tests/interaction/backlog-priority-filters.spec.ts](../tests/interaction/backlog-priority-filters.spec.ts)
  drives a **mock self-replacing chip** and asserts post-upgrade filtering still works.
- **FUI has a stable-event precedent — but only on *persistent* (B-family) hosts** (`tab-change`,
  `step-change`, `dock`; convention `new CustomEvent(name, { detail, bubbles: true, cancelable })`,
  [fui:blocks/stepper/StepperBehavior.ts](../../frontierui/blocks/stepper/StepperBehavior.ts) lines 20–21).
  **Every transient (A-family) element** (`we-button`/`we-badge`/`we-meter`/`we-text-field`/`we-filter-chip`)
  exposes state via native events + attributes, **never a CustomEvent**.
- **An open `addEventListener` sniff is already a *rejected* gate shape** — `compose-dont-handroll` (#933,
  [we:platform-decisions.md:728](../docs/agent/platform-decisions.md#L728)) rules it a "false-positive
  factory" and mandates a **curated, selector-scoped deny-list** instead (working precedent:
  `COMPOSE_DENY_LIST`, [we:scripts/check-standards-rules.mjs:1624](../scripts/check-standards-rules.mjs#L1624)).

## #1962 context (2026-07-01 wrapper-first; reconciled 2026-07-02 vs the #2015 census)

#1962 ruled the block catalog **wrapper-first**. The 2026-07-02 migration census (#2015) then reclassified
`we-filter-chip` as a **single native control** (it resolves to a native `<button>`,
[fui:blocks/filter-chip/FilterChipElement.ts:39-46](../../frontierui/blocks/filter-chip/FilterChipElement.ts#L39)),
so it migrates to a **persistent wrapper** under slice **#2122** (blockedBy #1974) — not a light-DOM leaf.
Post-migration **the chip no longer self-replaces**, so the motivating regression here (host listeners lost
on upgrade) **dissolves at the source**. Consequences, folded into the shape below:

- The **general consumer rule** ("delegate on a stable ancestor; never cache a self-replacing node") remains
  valid — as guidance for the **reserved transient case** (content-model children, #1962's break-glass
  mechanism), not the block catalog. **Codify it as a lean rider on the reserved-transient section of
  [we:block-standard.md](../docs/agent/block-standard.md)** (where #1962 codified), *not* a full
  `we-fui-embed-boundary` statute — post-migration the rule governs a currently-empty set of shipped blocks.
- **Fork 2 (the FUI event) is dissolved by the migration**, not decided — see its section below.
- **#2126** (the #2015 slice "WE chip-consumer cleanup + re-scope #1960 to the reserved case", blockedBy
  #2122) shrinks to the **WE-side consumer cleanup only** — the re-scope half is done by this ruling.

## The axis

The framing in the original card — *"which side of the WE↔FUI boundary owns the durable fix, A or B"* — is a
**false dichotomy** (the pass-0 / skeptic finding that reshaped this prep). WE must codify a consumer-facing
rule **either way**: even under a full Fork-B, WE "only consumes it and codifies the consumer-facing
contract" (WE holds zero implementation, #1282). And a FUI event would be **additive**, not exclusive —
native `click` still bubbles to the same delegated ancestor, so an event *supplements* delegation, it does
not replace it. So the decision is not one boundary fork; it decomposes into one **forced invariant** (codify
the consumer rule — already shipped) and **zero residual forks**. The enforcement question (originally
Fork 1) was **dissolved by the 2026-07-01 two-confusion screen (#2091, counter-verified)**; the FUI-event
question (originally Fork 2) was **dissolved 2026-07-02 by the #1962/#2015 migration reconciliation** — its
merit content evaporated with the chip's family change (see its section). Numbering kept for lineage.

## Recommended path at a glance

| Element | Verdict | Why |
|---|---|---|
| **WE consumer contract** (delegate on a stable ancestor; never cache the transient node; read `data-*`/`aria-pressed`, which survive upgrade) | **Supported by default — codify as a lean rider, not a fork** | The alternative (bind directly to the chip) is the *shipped regression*; forced invariant. Rider on the reserved-transient section of [we:block-standard.md](../docs/agent/block-standard.md) (#1962's break-glass case). |
| **Enforcement** *(settled — not a fork; dissolved 2026-07-01)* | interaction-test lane now; a #933-shaped curated gate is an *optional additive tooling build* if chip-selector wiring recurs | WE-internal tooling, invisible across the boundary; lane-vs-gate differs only on cost — ordering, not a ratify. |
| **FUI stable `chip-change` event** *(settled — not a fork; dissolved 2026-07-02)* | no standing question; post-#2122 it is an ordinary B-family feature request, filed only if a consumer materializes | Pre-migration moot (delegation shipped; chip leaving the family); post-migration both merit legs vs shipping it collapse — what remains is prioritization, and a fork is resolved by a principle, not a "now vs defer" call. |

## Supported by default — the WE consumer contract (forced invariant; codify)

This is **not a fork** (fork-existence test: the only alternative — bind a listener directly to the
`we-filter-chip` / cache its reference — is *broken*, it is exactly the shipped regression). Codify as a
consumer rule, anchored to the transient-family's *native-events-kept* guarantee
([we:block-standard.md:271](../docs/agent/block-standard.md#L271)) and the `we-fui-embed-boundary` cluster:

> **Wiring behaviour onto a transient (self-replacing) FUI element:** delegate the listener on a **stable
> ancestor** (container or `document`) and **re-query live**; **never** bind directly to the transient
> element and **never** cache its node reference. Read state from the attributes that **survive the upgrade**
> (`data-*`, `aria-pressed`) on the resulting native element, not from the pre-upgrade node.

```js
// ✓ survives the we-filter-chip → <button> upgrade (the shipped fix, backlog-table-sort.js:216-233)
document.addEventListener('click', function (e) {
  var chip = e.target.closest('[data-pfilter]');      // re-query live; data-* survived the upgrade
  if (!chip) return;
  applyFilter(chip.getAttribute('data-pfilter'),
              chip.getAttribute('aria-pressed') !== 'true');  // aria-pressed set on the native button
});
// ✗ the regression: dead the instant the FUI module upgrades the chip to <button>
chip.addEventListener('click', ...);   // listener bound to a node that replaceWith() discards
```

`codifiedIn` target: a **lean rider on the reserved-transient section** of
`we:docs/agent/block-standard.md` (alongside the #1961 robustness rider #1962 retained there) — not a
`we:platform-decisions.md` statute. Post-migration the rule governs only the break-glass
content-model-child case (currently zero shipped blocks), so it belongs with that mechanism's contract,
not in the boundary cluster.

## Settled (not a fork) — enforcement of the consumer rule (was "Fork 1")

*Screen: flagged(impl+prio) → dissolved, 2026-07-01 (#2091, counter-verified). Test-lane vs source-gate is
WE-internal enforcement tooling no consumer can observe across the boundary, and both branches yield the
identical consumer contract — the case against the additive gate was brittleness / maintenance /
duplication, i.e. cost. That makes this a tooling/ordering choice, not a ratifiable fork. Numbering kept
for lineage; nothing here needs a ratify turn.*

**Standing state:** the deterministic mock-chip lane
([we:tests/interaction/backlog-priority-filters.spec.ts](../tests/interaction/backlog-priority-filters.spec.ts))
is the enforcement — it reproduces the self-replace and asserts post-upgrade filtering, netting the
**actual** regression a source sniff only approximates. A **#933-shaped curated deny-list gate** (keyed to
the known chip selectors, following `COMPOSE_DENY_LIST`,
[we:scripts/check-standards-rules.mjs:1624](../scripts/check-standards-rules.mjs#L1624)) remains an
*optional additive tooling build*, filed and ordered like any other work **if chip-selector wiring recurs**
— its shape is already settled by statute #933 (never an open `addEventListener` sniff), so nothing about
it is a decision.

`Skeptic:` SURVIVES-WITH-AMENDMENT *(pre-dissolution history)* — the skeptic confirmed the *rule* is fine but
the originally-proposed heuristic gate is unconstitutional under #933 (open `addEventListener` sniffing
rejected). Amendment folded in: lane only; any future gate is constrained to the #933 curated-deny-list
shape.

## Settled (not a fork) — FUI stable `chip-change` event (was "Fork 2")

*Dissolved 2026-07-02 by the #1962/#2015 reconciliation. The #2091 screen had kept this alive as a genuine
go/no-go because, with cost stripped, a **merit** difference remained: the native-`click` double-signal
footgun plus family-A's *native-events-kept* clause (#1381) argued the event was harmful even if free. The
migration ruling ate both merit legs:*

- **The statute leg vanishes.** Under #2122 the chip becomes a **persistent (B-family) wrapper** — the
  family whose convention *is* minting bubbling CustomEvents (`tab-change`, `step-change`,
  [fui:blocks/stepper/StepperBehavior.ts](../../frontierui/blocks/stepper/StepperBehavior.ts) lines 20–21).
  #1381's family-A native-events-kept clause no longer applies to this control.
- **The double-fire leg loses force as a principle.** `tab-change`/`step-change` already coexist with
  native `click` on their hosts — FUI's own precedent treats the double-signal as an accepted design cost,
  not a disqualifier.

*With both merit legs gone, all that separates "ship it" from "don't" is whether a consumer needs it —
prioritization, which is not a fork: a fork is resolved by a principle, "now vs defer" is a timing
deferral, and you don't ratify "nobody needs it yet".*

**Standing state:** no standing question and no un-gate trigger to track. Pre-migration the chip's
delegation fix covers every consumer; post-#2122 a `chip-change` event on the persistent host is an
**ordinary convention-following FUI feature**, filed like any other build if and when a consumer (e.g. a
framework/non-DOM binding in plateau-app) materializes.

`Skeptic:` REFUTED the original B/B2-default *(pre-dissolution history)* — the prep's first pass
recommended FUI ship the event; the skeptic flipped the default (b)→(a) on four axes: (0) classification
(false dichotomy — WE codifies a rule either way); (1) merit (double-fire with native `click`);
(2) statute-overlap (#1381 family-A native-events-kept); (3) citation-scope (#1381 governs
mechanism-selection, not event-API design).

`Screen:` two passes — 2026-07-01 (#2091): **clear**, kept as a genuine additive go/no-go on the merit
residue above; 2026-07-02 (#1962/#2015 reconciliation): **dissolved**, the migration removed that residue
(this section).

## Context

- Surfaced from the Prioritisation-table regressions ([we:backlog-table-sort.js](../src/assets/js/backlog-table-sort.js)):
  dead summary pills + a silently-emptied table, both rooted in the upgrade dropping consumer wiring.
- Locked in by a deterministic interaction-test lane (`tests/interaction/`) whose **mock `<we-filter-chip>`**
  reproduces the self-replace; that harness is the regression net regardless of which fork is ratified.
- Boundary rule: WE holds zero implementation — so the consumer contract is codified WE-side as a *rule*
  (gates/validate-scripts are the only thing permitted in WE); any future `chip-change` event is built in FUI.

## Progress

- **Status:** RATIFIED 2026-07-02. Ruling: both original forks dissolved (enforcement 2026-07-01 via #2091;
  FUI event 2026-07-02 via the #1962/#2015 reconciliation — merit legs gone, remainder is prioritization);
  the forced invariant (delegate-on-stable-ancestor consumer rule) codified as a rider on the reserved-case
  contract, [we:block-standard.md#transient-exposed-api](../docs/agent/block-standard.md#transient-exposed-api)
  (also updated its stale "un-gate trigger tracked on #1960" pointer). #2126 scope shrunk to the WE-side
  consumer cleanup (its re-scope half done here). Red-team at ratify: strongest counter was "codify nothing —
  the reserved case ships zero blocks"; fails because the mechanism + #1961 contract are retained statute and
  the regression shipped twice — a contract without its consumer half is the documented trap re-armed.
- **Done:** claim → #1962/#2015 reconciliation amendment → ratify go → rider codified → resolve.

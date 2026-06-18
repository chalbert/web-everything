---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: "docs/agent/platform-decisions.md#compose-dont-handroll"
preparedDate: "2026-06-18"
locus: webeverything
relatedReport: reports/2026-06-18-933-enforce-compose-traits-over-hand-roll.md
relatedProject: webdocs
tags: [work-method, conformance, governance, traits]
codifiedIn: docs/agent/platform-decisions.md#compose-dont-handroll
---

# Reinforce the work method — enforce composing existing traits/contracts over hand-rolled reimplementation

**Prepared 2026-06-18.** No design existed for the *enforcement mechanism*; the forks below are grounded
in a conformance/lint/fitness-function prior-art survey published as the
[`enforce-compose-traits-conformance`](/research/enforce-compose-traits-conformance/) research topic
(session report linked via `relatedReport`), each with a recommended default in **bold**. The survey
**reshaped the original A/B/C framing**: A (advisory-only) is the *excluded* branch (it is what already
existed and failed twice), C (declarative-only) is *sequenced* after #932/#934 — neither is a rival to a
mechanical gate. So this item is now **one ratify (the invariant + "a mechanical gate is required") plus
two real forks inside the gate**.

The disclosure-nav incident (#931) exposed a process hole: a FUI block hand-wired `addEventListener` to
re-implement the APG disclosure pattern that **already exists** as the `nav:section` WE trait — and
nothing caught it. It happened once before (`sectioned-nav`, #870), so it is a recurring failure mode.

> **RATIFIED 2026-06-18.** The invariant is accepted as a standing invariant. **Fork 1 → A**
> (declaration-resolution + curated "pattern → trait" deny-list, warn-first). **Fork 2 → A**, with the
> field named **`composesBehaviors`** — chosen to parallel the *existing* `composesIntents` block field
> (`we:scripts/gen-cem.mjs:188`, surfaced during grounding) and because traits are typed `"Behavior"` in
> the block manifests (`we:src/_data/blocks/nav-list.json`); `composesTraits` stays rejected (The Map
> name-collision). Confidence ~80% Fork 1 / ~85% Fork 2; red-team did not land (no
> impl-is-not-a-standard / runtime-DI / most-permissive violation — the gate is a conformance rule,
> #436/#437, an author/build-time devtools seam, warn-first rollout). Codified as the
> [compose-don't-hand-roll](../docs/agent/platform-decisions.md#compose-dont-handroll) statute rule;
> spawns filed below (#NNN set on resolve).

## The invariant (accepted, to be codified — ratify)

A block/component MUST compose an existing WE trait/behavior/contract for any capability a standard
already covers (disclosure → `nav:section`, roving focus → `nav:list`). Hand-rolling an interaction a
registered trait provides is a conformance defect, not a style choice. New behavior is allowed — but it
is authored as a *new trait* (a `CustomAttribute`), never as ad-hoc per-block `addEventListener`. **And:
advisory enforcement alone is insufficient — a mechanical gate is required** (the advisory rule already
existed in spirit in the authoring skills + `we:AGENTS.md` and failed at #870 and #931; this is a forced
invariant, not a fork — see *Context* for why A was demoted).

## The axis

The enforcement mechanism decomposes into two orthogonal axes the research surfaced, both inside the
mechanical gate (the gate runs in `check:standards` over FUI source via the detect-or-skip precedent):

1. **Detection teeth** — how the gate *knows* a block hand-rolled a covered pattern. The trait runtime
   and the gate machinery already exist: traits register at
   `we:blocks/navigation/registerNavigation.ts:17-18`, the disclosure pattern the FUI blocks duplicate
   lives at `we:blocks/navigation/NavSectionBehavior.ts:77-87`, the hand-rolls are at
   `fui:blocks/disclosure-nav/DisclosureNav.ts:123,140` and `fui:blocks/sectioned-nav/SectionedNav.ts:73,87-88`,
   and the gate would sit beside `validateBlockImplConformance` (`we:scripts/check-standards-rules.mjs:1234`),
   warn-first per the #840/#844 precedent (`we:scripts/check-standards.mjs:176-180`).
2. **Declaration home** — where a block records the traits it *composes* (consumes). The CEM projection
   already carries a `traits` field at `we:scripts/gen-cem.mjs:185-194`, but it means traits a block
   *provides* (e.g. `we:src/_data/blocks/nav-list.json` defines `nav:list`/`nav:section`) — not what it
   consumes; and the name `composesTraits` was already **rejected** for The Map at
   `we:src/_data/traits.json:29`.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (rejected) | Confidence |
|---|---|---|---|
| 1 — gate detection teeth | **Declaration-resolution + a curated "pattern → trait" deny-list, warn-first** | Open-ended `addEventListener` sniffing / declaration-only | med-high (~75%) |
| 2 — composed-traits declaration home | **A new explicit block-protocol field, projected into `x-webeverything`, asserted against `we:src/_data/traits.json`** | Overload the existing `traits` field / reuse the rejected `composesTraits` name | high (~80%) |

## Fork 1 — the gate's detection teeth

*Fork-existence (case b — genuine either/or on the gate's teeth):* the two strategies cannot both be the
gate's primary signal — declaration-only can't flag a block that declares nothing and hand-rolls (the
exact #931/#870 mode), while open-ended source-sniffing carries real false-positive risk; you must pick
how aggressive the gate is.

- **A — Declaration-resolution + a curated "pattern → trait" deny-list, warn-first (default, ~75%).**
  The gate (i) asserts a block's *declared* composed traits (Fork 2's field) resolve against
  `we:src/_data/traits.json`, and (ii) runs a small **curated deny-list** mapping a detectable source pattern to the
  trait it must compose — e.g. click/keydown on an `aria-expanded` head → must compose `nav:section`;
  roving-tabindex wiring → `nav:list`. Staged warn-first (the #840/#844 / #477 precedent), escalating to
  ERROR once the deny-list is curated and false-positive-free. *Pros:* catches the actual failure mode (a
  block that hand-rolls a known pattern without composing the trait); the deny-list is narrow and
  individually suppressible (the durable ESLint/Spectral shape). *Cons:* the deny-list needs careful,
  ongoing curation; precision is the residual.
- **B — Open-ended `addEventListener` source-sniffing.** *Rejected* — flagging any `addEventListener` for
  "interaction-ish" patterns is a false-positive factory (the ESLint `no-restricted-syntax` lesson: open
  heuristics get disabled). Kept only in its *narrow, curated* form, which is option A.
- **C — Declaration-resolution only (no source check).** *Rejected* — a block that simply declares
  nothing and hand-rolls everything passes a declaration-only gate. That is precisely what
  `disclosure-nav` did (#931): declared no trait, hand-rolled the lot. Declaration-only would not have
  caught the incident that motivated this item.

**Recommendation: A, ~75%.** Residual ~25% = the deny-list's precision (which patterns are safe to flag
mechanically vs. left to the pre-flight checklist). Note: a *rendered* conformance check (axe) **cannot**
substitute — axe passed clean on #931 because a hand-rolled disclosure can be a11y-clean; the defect is
visible only in source + declaration, so this gate is static, not rendered.

## Fork 2 — where a block declares the traits it composes

*Fork-existence (case b — genuine either/or on the declaration home):* a block's *composed* (consumed)
traits and its *provided* traits are distinct facts that cannot share one field without ambiguity, so the
consumed set needs its own home, and the candidate homes are mutually exclusive choices of field.

- **A — A new explicit block-protocol field for composed traits (default, ~80%).** Add a field (e.g.
  `composes` / `composesBehaviors`) to the block `we:src/_data/blocks/<id>.json` entry, project it into
  CEM `x-webeverything` beside the existing `traits` field (`we:scripts/gen-cem.mjs:185-194`), and assert
  each entry resolves against the trait manifest `we:src/_data/traits.json`. *Pros:* clean separation of
  provided vs consumed; surfaces in the de-facto-standard CEM so tooling sees it; gives Fork 1's
  declaration arm a precise signal. *Cons:* one more block-protocol field to author.
- **B — Overload the existing `traits` field.** *Rejected* — that field means traits a block *provides*
  (`we:src/_data/blocks/nav-list.json` *defines* `nav:list`/`nav:section`); folding "consumes" into it
  conflates two opposite relationships (bias-to-separate).
- **C — Reuse the name `composesTraits`.** *Rejected* — `composesTraits` was explicitly rejected on
  2026-06-06 as the home for The Map's attribute→module table (`we:src/_data/traits.json:29`); reusing the
  name invites a footgun collision between "the global loader map" and "this block's consumed set."

**Recommendation: A, ~80%.** Residual ~20% = the exact field name (`composes` vs `composesBehaviors` vs
`composesTraits`-but-renamed) — a naming detail of A, not a separate fork.

## Spawned (ratified 2026-06-18)

- **#936** — the `composesBehaviors` block-protocol field (Fork 2) + its `x-webeverything` projection
  in `we:scripts/gen-cem.mjs` + the `we:src/_data/traits.json` resolution assertion.
- **#937** (blockedBy #936) — the gate arm `validateBlockComposesTraits` (Fork 1; `locus:
  webeverything`, beside `validateBlockImplConformance`), declaration-resolution + curated deny-list,
  warn-first.
- **#938** — codification: the invariant pre-flight into `we:AGENTS.md` + the authoring skills (the
  *complement* to the gate). The statute rule itself is already written at
  `we:docs/agent/platform-decisions.md#compose-dont-handroll` as part of this close-out.

---

## Context

**Why the original A/B/C is not a three-way fork (pass-0 reshaping, from the survey).**

- **A — Authoring pre-flight only (review-checklist) — demoted to *Supported by default*.** A required
  step in the authoring skills + an `we:AGENTS.md` rule ("before wiring an interaction, search the trait
  registry; compose, don't re-implement") is **necessary but insufficient**: it is essentially *what
  already existed in spirit* and failed at #870 and #931. So "advisory alone is enough" is the excluded
  branch — a mechanical gate is forced. The checklist still ships, as a complement to the gate, never as
  the enforcement.
- **C — Declarative-only enforcement — demoted to *Supported by default* (sequenced).** Making
  trait-composition the *only* path by construction (mode-C boots the registry per #932; blocks authored
  as trait-marked templates with no behavior code to hand-roll, #934) is the strongest long-term fix, but
  it is **not a rival** to the gate — it removes the *temptation* at source over time while the gate
  catches what slips *now*. It is gated on #932/#934 and tracked there, not decided here.

**Supported by default (not decisions):**

- The invariant itself (ratify).
- Keep the authoring pre-flight + `we:AGENTS.md` rule (complement, demoted A).
- Staged warn-first → ERROR rollout (the #840/#844/#477 precedent — a rollout knob, not a fork).
- Pursue the declarative-only path C, sequenced after #932/#934 (demoted C).

**Classification (full pass in the report):** WE-standard conformance layer; a conformance rule + a
block-protocol manifest field (not a protocol, not an intent dimension, no Technical Configurator card);
fixed mechanic (conformance is not opt-out — *Conventions Fold Into Compliance*, #436/#437); an
author/build-time devtools/provider seam, not a runtime DI registry; most-permissive *rollout* default =
warn-first.

Confidence ~75% Fork 1 / ~80% Fork 2. The residuals are the deny-list's precision (Fork 1) and the exact
field name (Fork 2) — neither blocks ratification of the direction.

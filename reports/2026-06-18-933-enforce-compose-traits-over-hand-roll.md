# Enforce composing existing traits over hand-rolled re-implementation — decision prep (#933)

**Date:** 2026-06-18 · **Item:** [backlog/933](../backlog/933-reinforce-the-work-method-enforce-composing-existing-traits-.md) · **Status:** prepared (open, awaiting ratification)

## The problem this decides

Two FUI chrome blocks hand-wired `addEventListener` to re-implement the W3C APG Disclosure
Navigation pattern that **already exists** as registered WE traits — `sectioned-nav` (#870), then
`disclosure-nav` (#931). Nothing mechanical caught either. The principle ("compose existing WE
contracts/traits, never re-implement what a standard provides") is settled; the open call is the
**enforcement mechanism** that makes hand-rolling structurally hard rather than a matter of reviewer
vigilance.

This report is the prior-art survey + classification that brings the fork to Definition of Ready.

## Grounding — the real tree (verified 2026-06-18)

The trait runtime and the conformance-gate machinery this would extend already exist:

- **The traits exist and are registered declaratively.**
  - `we:blocks/navigation/registerNavigation.ts:17-18` — `attributes.define('nav:list', NavListBehavior)` / `attributes.define('nav:section', NavSectionBehavior)`.
  - `we:blocks/navigation/NavSectionBehavior.ts:77-87` — the *exact* disclosure pattern (`aria-expanded` toggle, click + keydown handlers, ViewEngine show/hide) the FUI blocks hand-roll.
  - Mirrored in FUI: `fui:blocks/navigation/{registerNavigation,NavSectionBehavior,NavListBehavior}.ts`.
- **The hand-rolls (the defects this gate would catch).**
  - `fui:blocks/disclosure-nav/DisclosureNav.ts:123,140,154-156` — raw `addEventListener('click' | 'keydown')` + document/window dismissal listeners.
  - `fui:blocks/sectioned-nav/SectionedNav.ts:73,87-88` — same disclosure pattern hand-wired.
- **The trait runtime supports the host context.** `we:plugs/webbehaviors/CustomAttributeRegistry.ts:38` `upgrade(root: RootNode)` accepts `Document | DocumentFragment | ShadowRoot` (`we:plugs/core/types.ts`); `define`/`defineLazy` at lines 178/205. (This is what #932 decides about mode-C; #933 is the *gate*, independent of whether the registry boots in-document.)
- **The conformance-gate precedent.** `we:scripts/check-standards.mjs` composes pure rule validators from `we:scripts/check-standards-rules.mjs`; **`validateBlockImplConformance` (`we:scripts/check-standards-rules.mjs:1234`)** is the detect-or-skip block-impl gate this arm sits beside. Warn-first staging is established (`we:scripts/check-standards.mjs:176-180`, "warn-only, #477"; errors break CI, warnings don't — line 9/47-49). #840 (CEM analyzer over FUI source) and #844 (Check-2 tagName gate, `we:scripts/gen-cem.mjs:172-180`) are the warn-first→ERROR precedents the item cites.
- **The CEM projection already carries a `traits` field.** `we:scripts/gen-cem.mjs:185-194` projects `b.traits` into `x-webeverything.traits` — but today that means the behaviors a block **provides/defines** (via `blocks.*.attribute`, e.g. `we:src/_data/blocks/nav-list.json` defines `nav:list`/`nav:section`), *not* the traits it **composes/consumes**.
- **A per-block `composesTraits` field was already rejected.** `we:src/_data/traits.json:29` (The Map materialization, decided 2026-06-06): the attribute→module map is a **standalone `we:src/_data/traits.json` manifest**, explicitly "chosen over folding the map into per-block manifests (a `composesTraits` field on each block)." That rejection was about the *global loader table*, a different concern from "which traits does this block compose" — but it makes reusing the name `composesTraits` a footgun.

## How the research reshaped the fork (the A/B/C framing was partly a pass-0 miss)

The item's original A/B/C "fork" does not survive the fork-existence test as three rival branches:

- **A (advisory pre-flight only) is the *excluded* branch, not a co-equal option.** An advisory rule
  is empirically *what already existed* — the spirit of "compose, don't re-implement" lived in the
  authoring skills + `we:AGENTS.md` and **failed twice** (#870, #931). So "advisory alone is sufficient"
  is the flawed branch: a mechanical gate is a **forced invariant** (case (a)). The pre-flight stays
  as a *complement* (necessary but insufficient), not a rival → demoted to *Supported by default*.
- **C (declarative-only by construction) is not a rival to B — it is sequenced after #932/#934.** The
  item itself says "B composed with C's direction as #932 lands." C removes the *temptation* at the
  source over time; B catches what slips *now*. They compose → C demoted to *Supported by default*.
- **B (mechanical gate) is forced** — but B contains the two genuine open calls, which the original
  framing buried inside its "Cons":
  1. **The gate's detection teeth** — declaration-resolution only, or declaration **+** a curated
     source deny-list? (The item's own residual: "may need to lean on explicit declarations more than
     source-sniffing.")
  2. **The declaration home** — where a block records the traits it *composes* (consumes), given the
     `traits` field is taken for *provided* behaviors and `composesTraits` is a rejected name.

So the prepared item is: **ratify** the invariant + "mechanical gate required" (A/C dissolved), plus
**two real forks** inside B.

## Prior art surveyed (design-first step 1)

The decision designs an *enforcement mechanism for an architectural invariant*, so the survey is over
conformance/lint/fitness-function tooling, not a UI component:

- **W3C WAI-ARIA APG — Disclosure (Show/Hide) & Disclosure Navigation patterns.** The interaction the
  traits implement is a *named standard pattern* (button `aria-expanded`/`aria-controls` toggling a
  region; Escape collapses). This is *why* hand-rolling it is a conformance defect, not a style
  choice: a registered trait *is* the conformant implementation of a standard pattern. Grounds the
  deny-list's "pattern → trait" entries (disclosure → `nav:section`, roving tabindex → `nav:list`).
- **`eslint-plugin-jsx-a11y` / ESLint `no-restricted-syntax` & `no-restricted-imports`.** The
  canonical "flag a source AST pattern in CI" precedent. Two lessons carried into Fork 1: (i)
  AST/source rules ship **warn-first** then escalate to error to absorb false positives (exactly the
  #840/#844 staging); (ii) the durable rules are the *narrow, curated* ones (ban *specific* APIs /
  *specific* anti-patterns) — open-ended heuristics ("any `addEventListener` is suspect") are
  false-positive factories and get disabled. → favors a **curated deny-list** over open-ended
  source-sniffing.
- **Architectural fitness functions — ArchUnit, dependency-cruiser, ts-arch, eslint
  `no-restricted-imports`.** The "encode a layering/composition invariant as an automated CI test"
  family. Two takeaways: the rule is anchored on **declared structure** (a manifest / import graph /
  annotation), not on guessing intent from arbitrary code; and the strongest setups *combine* a
  declaration check with a small targeted ban-list. → favors **declaration-anchored** as the primary
  signal, deny-list as the backstop.
- **axe-core / Deque (rendered conformance) vs static lint.** axe checks the *rendered* DOM at
  runtime; lint checks *source*. The #931 retro is the cautionary tale: axe passed (0 violations)
  because a hand-rolled disclosure can still be a11y-clean — so a *rendered* conformance check would
  **not** catch this. The defect is "didn't compose the trait," which is only visible in **source +
  declaration**, not in rendered output. → confirms this gate belongs in `check:standards` (static),
  beside `validateBlockImplConformance`, not in the a11y/rendered path.
- **Open-core conformance precedents (Spectral custom rulesets, axe-core rules).** Reinforce the
  curated-ruleset shape: a small, named, individually-suppressible set of rules, each mapping a
  detectable pattern to a required construct — the shape Fork 1's deny-list should take.

The survey *added* the rendered-vs-static distinction (axe can't catch this — a non-obvious finding
that pins the gate to the static path) and *dissolved* the A/B/C three-way into ratify + two
sub-forks. A pass that only confirmed "B is right" would have been too shallow.

## Per-fork classification

- **Which layer?** The invariant + gate are **WE-standard conformance** (the contract: "compose the
  registered trait for a covered pattern"). The gate *runs* over FUI source via the detect-or-skip
  precedent (`validateBlockImplConformance`) — WE owns the check, FUI is the checked. The declaration
  field is a **block-protocol** addition (CEM `x-webeverything`), i.e. WE contract.
- **Protocol or intent dimension?** Neither — it is a *conformance rule + a manifest field*, not a UX
  dimension and not a new protocol. No Technical Configurator card (it is a build gate, not a
  project-tunable setting).
- **Expose the whole axis / fixed mechanic vs dimension?** Fixed mechanic. "Whether to enforce" is
  not a project-configurable dimension — conformance is not opt-out (per the *Conventions Fold Into
  Compliance* rule, webcompliance enforces it; #436/#437). The warn→error *stage* is a rollout knob,
  not a permanent dimension.
- **DI-injectable?** No — this is an author/build-time gate (a devtools/conformance seam), not a
  runtime registry the running app consults. (Per *Runtime DI vs Devtools Provider Seam*: a capability
  consulted once at build time is a provider seam, not a global registry.)
- **Most-permissive default?** The *rollout* default is the most permissive that still moves: **warn-
  first** (#840/#844), escalate to ERROR once the deny-list is curated and false-positive-free.
- **Seam / bias to separate?** The declaration of *composed* traits is a distinct concern from the
  declaration of *provided* traits — bias-to-separate says give it its own field, not an overload of
  the existing `traits` field (Fork 2).

## The two prepared forks (defaults)

- **Fork 1 — gate detection teeth.** Default: **declaration-resolution + a curated "pattern → trait"
  deny-list**, warn-first. Reject open-ended `addEventListener` sniffing (false-positive factory per
  the ESLint lesson); reject declaration-only (can't catch a block that declares nothing and
  hand-rolls — the exact #931/#870 mode). Confidence ~75%; residual = the deny-list's precision.
- **Fork 2 — declaration home.** Default: a **new explicit block-protocol field** for *composed*
  traits (e.g. `composes` / `composesBehaviors`), projected into `x-webeverything`, asserted to
  resolve against `we:src/_data/traits.json`. Reject reusing `traits` (semantic overload — provided vs consumed)
  and reject the name `composesTraits` (rejected 2026-06-06 for The Map; name-collision footgun).
  Confidence ~80%; residual = the exact field name.

## If ratified — spawns (build, not authored here)

- A `check:standards` arm `validateBlockComposesTraits` beside `validateBlockImplConformance`
  (`we:scripts/check-standards-rules.mjs`), warn-first.
- The new block-protocol field + its `x-webeverything` projection (`we:scripts/gen-cem.mjs`) + a `we:src/_data/traits.json`
  resolution assertion.
- Codification: the invariant into `we:AGENTS.md` + `docs/agent/*` + the block/standard-authoring
  skills' pre-flight (the complement, not the enforcement).
- The declarative-only path C tracked under #932/#934 (sequenced, not part of this build).

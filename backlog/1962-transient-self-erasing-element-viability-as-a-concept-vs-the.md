---
kind: decision
status: resolved
locus: webeverything
dateOpened: "2026-06-29"
dateStarted: "2026-07-01"
dateResolved: "2026-07-01"
graduatedTo: none
preparedDate: "2026-06-29"
codifiedIn: "docs/agent/block-standard.md#packaging-governance-1321"
relatedReport: reports/2026-06-29-transient-self-erasure-concept-viability.md
tags: [webcomponents, transient-element, block-standard, standards-position, native-semantics, decision]
---

# Transient (self-erasing) element — viability as a concept vs the standards-endorsed alternatives

**RULING (2026-07-01): wrapper-first. Transient is demoted from the reference shape to a reserved break-glass
mechanism.** The concept-level re-judgment of the transient / A-family pattern
([fui:blocks/transient/TransientElement.ts:53-76](../../frontierui/blocks/transient/TransientElement.ts#L53-L76))
**reverses** the prepared "reaffirm transient" default. Web components work well in the common case, and we add a
standard only for a strong reason: self-erasure is spec-unsanctioned (self-deletion in a reaction;
`connectedCallback` can fire `>1×` / with `isConnected===false`; **no mainstream library self-erases at runtime**,
#1961 survey), so it will draw standards pushback. **Unless there is an absolute killer use case, avoid it.**

## The ruling in one paragraph

The default runtime shape for native-control blocks is **(B) a persistent element that *contains* a real native
control** (the Shoelace `<sl-input>` shape) — never a self-erasing host. Purely-presentational leaves
(badge/tag/card/progress/meter/filter-chip) are **light-DOM** (a `display:contents` wrapper where a box would
break flex/grid). **Transient (A) is retained in the standard but reserved for one absolute case: a
content-model-constrained native child** (`<option>` in `<select>`, `<tr>`/`<td>` in `<table>`, `<summary>` in
`<details>`) where a wrapper *structurally breaks* the native parent — the exact "parser case" WebKit itself kept
when it killed `is=`. **No current block qualifies, so transient ships nowhere today**; the mechanism plus its
#1961 robustness/API contract are held for that reserved case only.

## Why the prepared "reaffirm transient" default was reversed

The prep leaned on transient being **load-bearing for form controls** ("native chrome/IME/validation can't be
reproduced"). **Grounding refutes this** (skeptic red-team, four axes — *attack fails, ruling survives*):

- **The codebase already disproves the thesis.** `createTextField` builds `<div class="fui-text-field">` wrapping
  a **real `<input>`** ([fui:blocks/text-field/TextField.ts:86-153](../../frontierui/blocks/text-field/TextField.ts#L86-L153));
  transient only erased the *outer* `<we-text-field>`. So the native input was **already nested in a div** — the
  "bare zero-wrapper native input" transient supposedly buys was never delivered for the family where it was
  claimed to be irreplaceable.
- **A wrapper containing a real native control reproduces every native behaviour.** IME, mobile keyboard, autofill,
  the date/color/file picker chrome, `:user-valid`/`:user-invalid`, label click-through (`<label for>` → inner
  input id, already done), implicit form submission, validation-bubble anchoring, focus — **all delivered by the
  inner real `<input>`**, not by the host. Transient's *only* additional payoff is deleting the outer node, which
  none of those behaviours need. `ElementInternals` (the shim-only alternative) gives form-association + ARIA role
  + custom states but **not** native behaviour — but the wrapper never relies on it; it holds a real control.
- **The zero-wrapper win is weakest exactly for form controls** (an `<input>` in a wrapper causes no layout-nesting
  problem), and strongest for presentational leaves — which are moved to **light-DOM** anyway, not transient.
- **No absolute case exists beyond content-model-constrained children.** Layout/CSS cases (flex/grid direct-child,
  `:nth-child`, `contain`, subgrid) are handled by `display:contents` (erases the box; the residual node/AX/selector
  cost is a *cost*, not a *break*). A wrapper only ever *structurally breaks* a native parent's content model.

## WebKit #97 — reconciled, now *reinforcing* wrapper-first

WebKit's `oppose` ([standards-positions #97](https://github.com/WebKit/standards-positions/issues/97)) targets
customizing a native element **in place** via `is=`. Its constructive recommendation — a **persistent** host with
real native semantics — is an argument **for** the wrapper family, not for self-erasure. So #97 now *reinforces*
this ruling: persistent-host-containing-a-real-control is exactly what WebKit and the whole industry (Lit,
Shoelace, Web Awesome — none self-erase) endorse. `is=` remains dead + statute-barred (Safari's permanent
`oppose` + the native-first single-substrate floor,
[native-first-baseline](../docs/agent/platform-decisions.md#native-first-baseline)): demote-not-forbid, usable
only as opt-in progressive enhancement, never load-bearing.

## Statute reconciliation (amendments this ruling forces)

This reverses the transient default that a recent cluster ratified as the *reference shape*. The amendments are
consequential (logically entailed by this ruling), carried here:

- **§7 item 7 / #1381** ([we:block-standard.md → Packaging governance](../docs/agent/block-standard.md#packaging-governance-1321))
  — button + behaviour-free-leaf default flips from **(A) transient** to **(B) persistent wrapper / light-DOM**.
  Transient is recorded as the reserved content-model-child mechanism, not the reference shape.
- **§7 item 7 / #1456** — single text-field/number-input flips **(A) → (B)** persistent wrapper containing a real
  inner `<input>`.
- **#1963 composition-rubric rules 3/4/5** — "irreplaceable-native blocks MUST emit native" is **redefined**:
  "emit native" is satisfied by a persistent wrapper that *contains* a real native control (not a transient-emitted
  one). The rule's intent (keep real native chrome; don't hand-roll a fake input) is preserved; the mechanism
  flips. "Load-bearing native output → transient" becomes "→ wrapper-with-real-native (transient only for
  content-model children)."
- **§7 item 8 / #1961** — the "Transient (A) exposed-API contract" is retained but **scoped to the reserved
  break-glass case**; it no longer governs shipped blocks.

## The reserved case, spelled out

Transient (A) is permitted **only** where the authored element must *become* a specific native child that its
native parent will only recognize as the real tag — `<option>`/`<optgroup>` in `<select>`, `<tr>`/`<td>` in
`<table>`, `<li>` in `<ul>`, `<summary>` in `<details>`. There, a wrapper is structurally impossible (the parent
won't render a wrapped child), so emit-then-erase is the only mechanism. **No FUI block hits this today.** If one
is authored, it inherits the #1961 robustness rider: self-replacement **must** be idempotent (`#replaced` guard,
present), microtask-deferred (`queueMicrotask`, present), **and `isConnected`-guarded** (a real one-line gap in
`TransientElement` today — filed under the FUI migration item as reserved-mechanism hardening).

## Relationships

- **Reverses** the ratified transient default in §7 item 7 (#1381) — see *Statute reconciliation*. The historical
  ratifications stand as lineage; their rule text is amended to wrapper-first with a #1962 citation.
- **Case 1's facet of [#1963](1963-composition-rubric-re-judged-to-framework-parity-strict-per-.md)** — resolved
  under #1963's framework-parity bar, which #1963 delegated here. #1963 found emit-to-native is *full parity* for a
  behaviour-free leaf; this ruling accepts that a wrapper is *near*-parity yet rules the parity gap **not worth**
  the spec-unsanctioned self-erasure for any non-content-model case. `blockedBy: #1963` satisfied (resolved
  2026-06-29).
- **Supersedes the premise of [#1974](1974-expose-transient-vs-light-dom-as-a-configurable-per-project-.md)** —
  the soft-7 are light-DOM full-stop (no transient opt-in to expose); #1974 repointed to a light-DOM migration.
- **Changes the context of #1960 / #2009** — the filter-chip transient-upgrade listener contract (#1960) and the
  transient identity-survival fix (#2009) become moot for blocks once migrated to persistent/light-DOM; they stand
  as near-term mitigations until the migration lands.

## Progress

- **Status:** RULING RATIFIED 2026-07-01 (wrapper-first; transient reserved for content-model children).
- **Done:** re-judged at concept level; skeptic red-team (attack fails); ruling + statute-reconciliation authored;
  #1381/#1456/#1963/#1961 amended; #1974 repointed; FUI migration item filed.
- **Next:** resolve; FUI migration review of the ~13 current transient blocks proceeds under the filed item.

---
kind: decision
status: resolved
dateOpened: "2026-06-27"
dateStarted: "2026-06-27"
dateResolved: "2026-06-27"
graduatedTo: "docs/agent/platform-decisions.md#native-first-baseline"
preparedDate: "2026-06-27"
relatedReport: reports/2026-06-27-plug-as-proposed-standard-doctrine.md
relatedProject: webplugs
codifiedIn: docs/agent/platform-decisions.md#native-first-baseline
tags: [plugs, polyfill, ponyfill, prollyfill, extensible-web, native-first, doctrine, decision-prep]
---

# Decision-prep doctrine: a plug is a proposed missing standard, unplugged is safe-now

## Digest

When a decision concerns a capability **elemental to web applications but absent from every platform
spec** — not merely below the Baseline-2024 floor (that's already `we:docs/agent/platform-decisions.md#native-first-baseline`)
— WE's posture is **dual**: **UNPLUGGED** is safe-today usage of only what the platform actually ships
(non-invasive, enforcement-free — the real product surface per #606); **PLUGGED** is the proposed
standard materialized as runnable code, carrying enforcement/polyfill, the candidate to take upstream.
Can't wait, can't force, so we do both. The prior-art survey (`relatedReport`) shows the ecosystem
already names this split one-for-one — **ponyfill** (non-global, side-effect-free) = unplugged,
**polyfill** (global monkey-patch) = plugged-bootstrap, **prollyfill** ("a polyfill for a not-yet-
standardized API") = plugged-as-proposed-standard — under the **Extensible Web Manifesto**'s "expose
primitives, prototype in JS, standardize what wins." This item codifies the posture as a standing rule
+ a `/prepare` lens so future forks of this shape are framed plugged(proposed)+unplugged(safe-now)
automatically, never collapsed to a single forced choice that throws out a real capability. First
application: #1807 (already prepared, `blockedBy` this).

## Decision axis — one contract, a delivery+enforcement axis (not two contracts)

The axis is **not** "which implementation do we pick." It is: *given a capability the platform leaves a
gap on, do we ship one posture or two, and what reconciles "the plugged polyfill is our proposed
standard" with the floor statute that says polyfills are never part of the standard?* The load-bearing
grounding, traced to the real tree:

- **The unplugged form is the product, the plugged form is the proof vehicle** — already an invariant,
  not a new claim: `we:backlog/606-where-does-the-plugs-platform-layer-runtime-live-web-everyth.md:62-66`
  ("Every plug must have a non-invasive *unplugged* form … the supported real-app surface. Plugged/
  global-patching mode is **POC/demo only**"; both modes ship enforced tests). The impl lives in FUI,
  never as a `@webeverything` standard artifact (#606 rejected option A).
- **The floor statute WE must stay consistent with:** `we:docs/agent/platform-decisions.md:793-795`
  (`#native-first-baseline`) — "A spec stays **single-substrate** — it never carries a dual native-vs-
  shimmed contract — and **polyfills are an opt-in enhancement layer the consumer adds, never part of
  the standard**." The doctrine's **guardrail** is what reconciles it: the *contract* stays single-
  substrate; plugged/unplugged is a **delivery+enforcement axis** over that one contract. Enforcement-on
  (plugged rejects an un-declared use) vs enforcement-off (unplugged permits it) is one contract at two
  *levels* — the TypeScript `--strict` analogy — **not** two contracts. So "plugged = the proposed
  standard" names the *upstream-candidate role of the impl*, and the polyfill never becomes a standard
  artifact. The floor statute is preserved, not contradicted.
- **The partition grain:** `#native-first-baseline` already lists `:state()`/`CustomStateSet` as part of
  the Baseline-2024 floor (`we:docs/agent/platform-decisions.md:792`), yet #1807 plugs a custom-state
  *declaration/validation layer* — proof the boundary runs **between layers of one capability**
  (`we:backlog/1807-declarative-custom-state-surface-how-a-component-declares-to.md:23`), decomposed
  first then classified per-layer.

## Recommended path at a glance

| Fork | Question | Recommended default | Confidence |
|---|---|---|---|
| 1 · The doctrine | Adopt the dual plugged/unplugged posture as a **standing rule**? | **Yes — forced invariant** (a single forced choice sacrifices either safety-today or the upstream proposal) | high |
| 2 · Partition | How does this divide from `#native-first-baseline`? | **Per-layer present-vs-absent** against the shipping platform (decompose, then classify each layer) | high |
| 3 · Codification | Where does the rule live? | **Corollary under `#native-first-baseline`** + a prep-lens paragraph in `we:docs/agent/backlog-workflow.md` | med-high |

## Ratified ruling (2026-06-27)

**Ratified as prepared** (discussed + red-teamed across the #1807 conversation; the "renames #606 / contradicts the floor statute" attack failed on altitude + the single-substrate guardrail). All three forks resolve to their bold defaults:
- **Fork 1 — dual posture as a standing rule** (forced invariant): every elemental-but-missing capability is framed unplugged(safe-now) + plugged(proposed-standard) over one single-substrate contract.
- **Fork 2 — per-layer present-vs-absent partition** against the shipping platform (decompose, then classify each layer); spec-maturity rejected as the boundary.
- **Fork 3 — fold a corollary under `#native-first-baseline`** (not a sibling anchor) + a standing-lens paragraph in `we:docs/agent/backlog-workflow.md`.

**codifiedIn:** the *plug-as-proposed-standard* corollary under `we:docs/agent/platform-decisions.md#native-first-baseline` + the standing-lens paragraph in `we:docs/agent/backlog-workflow.md`. First application: #1807 (`blockedBy` this — now unblocked).

## Fork 1 — Adopt the dual plugged/unplugged posture as a standing rule

*Fork-existence (forced invariant):* the excluded branch — **force a single posture per capability** —
is broken. A single choice sacrifices one of two things the gap genuinely needs simultaneously: either
you ship enforcement consumers can't safely adopt (the invasive global-patching runtime that #606 found
is *not* the product), **or** you never materialize the proposed standard you'd take upstream. The
#1807 first-skeptic slip is the live evidence: killing "validation as the default" correctly, a single-
posture call *threw validation out entirely* — until the dual axis rescued it as the *plugged* posture.
"Can't wait (ship safe-now), can't force (the platform decides), so do both" is the invariant.

- **(a · DEFAULT) Dual posture as a standing rule.** Every elemental-but-missing capability is framed
  as unplugged(safe-now) + plugged(proposed-standard) over one single-substrate contract. Generalizes
  #606's per-runtime finding into a reusable decision-prep lens.
- **(b) Per-capability case-by-case call.** *Rejected:* re-derives the same tension every time and
  invites the single-posture slip above; the prior-art triad shows the split is universal, not bespoke.

**Skeptic: SURVIVES-WITH-AMENDMENT.** Attack: "this duplicates #606, and 'plugged = the proposed
standard' contradicts the floor statute (polyfill is never the standard, `we:docs/agent/platform-decisions.md:794`)."
Answered by **altitude + reconciliation** — #606 *places one runtime*; this *generalizes its insight
into a reusable lens*; the single-substrate guardrail + "contract→WE, impl→FUI" keep it consistent
(enforcement-on/off is one contract at two levels, not two contracts). Amendment folded in: the
Decision-axis section now states the altitude and the reconciliation explicitly.

## Fork 2 — The partition rule vs `#native-first-baseline`

*Fork-existence (forced invariant):* without a crisp partition the two statutes **contradict** —
`#native-first-baseline` says "polyfills are never part of the standard," this says "the plugged polyfill
is our proposed standard." Exactly one boundary is correct; a fuzzy one leaves the statutes in conflict
(broken), so the boundary must be decidable.

- **(a · DEFAULT) Per-layer present-vs-absent against the shipping platform.** Decompose the capability
  into layers; classify **each layer** by whether *it* is present in a browser you can ship on today. A
  layer that is present → `#native-first-baseline` (use it natively; if below the floor, the consumer's
  opt-in polyfill, **no** proposed-standard ambition). A layer that is **entirely absent from every
  spec** → this doctrine (plugged = the prollyfill candidate). #1807 is the worked example: `:state()`
  primitive present → native; declaration/validation layer absent → plugged.
- **(b) "Does a spec exist upstream?"** *Rejected:* undecidable at the boundary — WICG draft? TAG
  explainer? one browser's experimental flag? Spec-maturity informs whether the plugged candidate is
  worth *pursuing* upstream, but it is the wrong axis for *which statute applies*.
- **(c) Apply the dual posture to everything platform-incomplete (incl. below-baseline).** *Rejected:*
  re-litigates `#native-first-baseline`'s settled "below the floor = out of scope"; would have WE ship
  prollyfills for already-specced-but-old features, which is plain progressive enhancement, not a
  proposed standard.

**Skeptic: SURVIVES-WITH-AMENDMENT.** Attack: "'does a spec exist upstream' is undecidable, and #1807
splits one capability across both statutes." Correct — and it *revealed* the right grain: the boundary
is **per decomposed layer**, not per capability, and the test is the decidable **present-vs-absent**
check, not spec-maturity. Default reframed accordingly (the original spec-maturity phrasing is rejected
as option (b)).

## Fork 3 — Codification structure: where the rule + the prep-lens live

*Fork-existence (genuine either/or):* a new dedicated anchor and a fold-in corollary are both coherent
but **cannot coexist** — the rule has exactly one statute home, and putting it in two guarantees drift
(the cite-the-rule discipline, `we:docs/agent/platform-decisions.md:54-58`).

- **(a · DEFAULT) Fold the statute as a named corollary under `#native-first-baseline`** (mirroring the
  existing "Polyfill-surface fidelity (corollary)" block, `we:docs/agent/platform-decisions.md:799-814`),
  with #1826 lineage; the corollary restates the #606 constraint ("still implementation, never a
  `@webeverything` artifact") so the doctrine stays honest. **The prep-lens half goes in
  `we:docs/agent/backlog-workflow.md`** (where the prep method lives), cited — not restated — from the
  `prepare-decision-item` skill.
- **(b) Mint a new sibling anchor `#plug-as-proposed-standard` that *refines* `#native-first-baseline`.**
  *Rejected (skeptic-flipped):* this doctrine is the **exception clause** of the floor statute, not an
  orthogonal concern; a sibling anchor fragments one "native-completeness" concern across two homes that
  drift. (The cited precedent `#contract-surface-platform-idiom` is genuinely orthogonal — it shapes
  *new* surfaces — so it doesn't support minting one here.)
- **(c) Put the prep-lens in the skill's own `we:.claude/skills/prepare-decision-item/SKILL.md`.**
  *Rejected:* violates the skill's own discipline ("the method lives in `we:docs/agent/backlog-workflow.md`;
  don't restate the rubric here") — the skill is a trigger+pointer.

**Skeptic: SURVIVES-WITH-AMENDMENT → default flipped.** The original lean was a new anchor (option b);
the skeptic argued the doctrine is the floor statute's own exception clause and `#native-first-baseline`
already hosts corollaries with stacked lineage, so a sibling anchor drifts and violates cite-the-rule.
The fold-in (a) is now the default; (b) stays the named escape hatch if the doctrine later grows beyond
a corollary.

## Supported by default (not forks)

- **Naming — "plugged"/"unplugged".** Existing #606 / `we:plugs/` vocabulary; not re-litigated.
- **The single-substrate guardrail.** Consistent with `#native-first-baseline`'s own "spec stays
  single-substrate"; it's the doctrine's reconciliation clause, not a weighed branch.
- **Both homes exist (statute + prep-lens).** Not competing — the statute *is the rule*, the prep-lens
  is *how `/prepare` applies it*. Both are needed (support-both); only Fork 3 weighs the *structure*.

## Resolution shape (what this graduates into)

On ratification this decision spawns:
1. **Statute edit** — the corollary under `we:docs/agent/platform-decisions.md#native-first-baseline`
   (`codifiedIn` target), with #606/#1807/#1826 lineage.
2. **Prep-lens edit** — a paragraph in `we:docs/agent/backlog-workflow.md` framing elemental-but-missing
   forks as plugged(proposed)+unplugged(safe-now), cited from the `prepare-decision-item` skill.
3. **Unblocks #1807** (`blockedBy: [1826]`) — the first application, already prepared against this axis.

## Lineage

Generalizes **#606** (unplugged-is-product / plugged-is-POC, plug impl → FUI) into a reusable doctrine;
refines **`#native-first-baseline`** (the floor statute it folds a corollary into). First application
**#1807** (`blockedBy` this). Prior art: the polyfill/ponyfill/prollyfill triad + the Extensible Web
Manifesto (`relatedReport`). Related memory: `project_plug_is_proposed_missing_standard`.

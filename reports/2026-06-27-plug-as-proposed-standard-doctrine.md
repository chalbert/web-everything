# Plug-as-proposed-standard doctrine — prior-art survey & prep (#1826)

**Date:** 2026-06-27 · **Item:** [#1826](/backlog/1826-decision-prep-doctrine-a-plug-is-a-proposed-missing-standard/) · **First application:** [#1807](/backlog/1807-declarative-custom-state-surface-how-a-component-declares-to/)

## The question

When a decision concerns a capability that is **elemental to web applications but absent from the
platform spec** — not merely below the Baseline-2024 floor (that's already covered by
`#native-first-baseline` in we:docs/agent/platform-decisions.md) — what posture does WE take? The
item proposes a **dual** posture and asks to codify it as a standing rule + a decision-prep lens so
future forks of this shape are framed consistently instead of re-derived (or collapsed to a single
forced choice that throws out a real capability — the exact slip #1807's first skeptic made).

## Prior art — the polyfill / ponyfill / prollyfill triad + the Extensible Web

The ecosystem already has precise vocabulary for *exactly* this three-way split. WE's plug postures
map onto it one-for-one — which is the strongest evidence the doctrine is real prior art, not a
bespoke invention.

| Ecosystem term | Definition | WE posture it maps to |
|---|---|---|
| **Polyfill** | Adds a missing feature by **monkey-patching globals** (`window`, `Array.prototype`) — invasive, side-effecting. ([MDN Glossary](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill)) | WE's **plugged-bootstrap** mode (we:plugs/bootstrap.ts patches `window`/`Node`/`Element`) — POC/demo only per [#606](/backlog/606-where-does-the-plugs-platform-layer-runtime-live-web-everyth/). |
| **Ponyfill** | Same functionality as a polyfill but **non-global, side-effect-free** — explicit import, never mutates the environment. (Sindre Sorhus, [sindresorhus/ponyfill](https://github.com/sindresorhus/ponyfill)) | WE's **unplugged** mode (we:plugs/unplugged.ts — `register`/`upgrade`, no `window`/prototype mutation) — **the real product surface** (#606 invariant). |
| **Prollyfill** | "A polyfill for a **not-yet-standardized** API" — implements a feature *before* it is standardized, as a candidate for the platform. (Alex Sexton, [2012](https://twitter.com/SlexAxton/status/257543702124306432); [Kiko Beats](https://kikobeats.com/polyfill-ponyfill-and-prollyfill/)) | WE's **plugged-as-proposed-standard** — the capability materialized as runnable code, the candidate to take upstream. |

**The Extensible Web Manifesto** ([2013, W3C Extensible Web CG](https://www.w3.org/community/nextweb/2013/06/11/the-extensible-web-manifesto/);
[extensibleweb/manifesto](https://github.com/extensibleweb/manifesto)) is the governing philosophy:
the platform should expose **low-level primitives**, developers **prototype high-level features in
JS** ("pave the cowpaths"), and the patterns that win get **standardized** — innovation decoupled
from browser release cycles. That cycle is precisely WE's plugged posture: prototype the missing
standard in code, prove it on the real product surface, take the winner upstream (WICG → WHATWG/W3C).
The W3C TAG's [*Polyfills and the evolution of the Web*](https://www.w3.org/2001/tag/doc/polyfills/)
is the canonical guidance on doing this responsibly.

## The WE semantic delta — what the doctrine adds over the prior art

The triad treats polyfill/ponyfill/prollyfill as **deployment styles of one body of code**. WE adds
three things the ecosystem vocabulary does not:

1. **Single-substrate contract as the invariant.** The contract is **one** (single-substrate, per
   `#native-first-baseline`); plugged/unplugged is a **delivery + enforcement axis** over that one
   contract, never two competing contracts. (Enforcement-on vs enforcement-off is an enforcement
   *level* of one contract — the TypeScript `--strict` analogy — not a second contract. This is the
   reconciliation that keeps the doctrine consistent with `#native-first-baseline`'s "a spec stays
   single-substrate; polyfills are an opt-in enhancement, never part of the standard.")
2. **Constellation placement.** WE owns only the **contract**; FUI owns **both** impls (the unplugged
   ponyfill *and* the plugged polyfill/prollyfill) per #606. "Plugged = the proposed standard" names
   the *upstream-candidate role of the impl*, and never makes the polyfill a `@webeverything`
   artifact — #606's "plug impl → FUI, never a standard artifact" is preserved, not reversed.
3. **The partition against the floor.** The discriminator is **present-vs-absent against the shipping
   platform, applied per decomposed capability-layer** — *not* a spec-maturity question. See below.

## The partition (refined by the skeptic pass)

A naive partition — "does a spec exist upstream? yes → native-first-baseline; no → #1826" — is
**undecidable** at the boundary (WICG draft? TAG explainer? one browser's experimental flag?). The
skeptic refuted it and, in doing so, revealed the correct grain:

- **Decompose the capability into layers first**, then classify **each layer** by whether *it* is
  present in the shipping platform today. #1807 is the worked example, not a counterexample: the
  `:state()`/`CustomStateSet` **primitive** is Baseline-2024 → use it natively (`#native-first-baseline`
  governs *it*); the **declaration/validation layer** ("how a `<component>` declares & validates its
  state vocabulary") is absent from every spec → #1826 governs *that layer* (plugged = the proposed
  standard). The boundary runs *between layers of one capability*, which is the same
  decompose-then-classify discipline WE uses everywhere.
- The decidable test is **"is this specific layer present in the platform you can ship on today?"** —
  a concrete present/absent check against what browsers expose, not a maturity judgment. Upstream
  spec-maturity is irrelevant to *which statute applies*; it only informs whether the plugged candidate
  is worth *pursuing* upstream.
- **Below-baseline-but-specced** stays with `#native-first-baseline` (out of scope / consumer's opt-in
  polyfill, **no** proposed-standard ambition — a standard already exists to defer to). **Elemental-but-
  entirely-absent** gets #1826 (plugged = the prollyfill candidate, because no standard exists yet).

## Codification structure (flipped by the skeptic pass)

Initial lean was a **new dedicated anchor** `#plug-as-proposed-standard`. The skeptic argued — correctly
— that the doctrine is the **negative space / exception clause** of `#native-first-baseline` ("polyfill
is never the standard… *except when the gap is total, the plugged polyfill is the upstream candidate*"),
and that `#native-first-baseline` **already hosts corollaries** (Polyfill-surface fidelity) with stacked
lineage. A sibling anchor fragments one "native-completeness" concern across two homes that drift, and
violates the cite-the-rule discipline. **Resolution: fold the statute in as a named corollary under
`#native-first-baseline`** (mirroring the fidelity corollary), with #1826 lineage; the corollary restates
the #606 constraint so the doctrine stays honest. The **prep-lens half** goes in
we:docs/agent/backlog-workflow.md (where the prep method lives — the skill is a trigger+pointer and must
not restate the rubric), cited from the skill.

## Skeptic verdicts (folded in)

- **Core doctrine — SURVIVES-WITH-AMENDMENT.** The attack ("duplicates #606; 'plugged = proposed
  standard' contradicts the floor statute") is answered by **altitude + reconciliation**:
  #606 *places one runtime*; #1826 *generalizes its insight into a reusable decision-prep lens* for
  any elemental-but-missing capability. The single-substrate guardrail + "impl→FUI, contract→WE"
  keep it consistent with the floor statute; enforcement-on/off is one contract at two levels, not two
  contracts. Amendment: state the altitude and the reconciliation explicitly (done).
- **Fork 1 partition — SURVIVES-WITH-AMENDMENT.** "Does a spec exist upstream" was refuted as fuzzy;
  reframed to the decidable **per-layer present-vs-absent** test (above).
- **Fork 2 codification — SURVIVES-WITH-AMENDMENT → default flipped.** Fold as a corollary under
  `#native-first-baseline`, do not mint a sibling anchor.

## Recommendation

Adopt the dual posture as a standing rule, codified as a **corollary under `#native-first-baseline`**
+ a **prep-lens paragraph in we:docs/agent/backlog-workflow.md**, with the **per-layer present-vs-absent**
partition. Confidence: **high** on the doctrine and partition (one-for-one prior-art map + skeptic-
survived); **med-high** on the codification structure (the skeptic's fold-in is the better call but a
sibling anchor remains defensible if the doctrine later grows beyond a corollary).

## Sources

- [MDN — Polyfill (Glossary)](https://developer.mozilla.org/en-US/docs/Glossary/Polyfill)
- [sindresorhus/ponyfill](https://github.com/sindresorhus/ponyfill) — ponyfill = non-global, side-effect-free
- [Alex Sexton — "Prollyfill: a polyfill for a not yet standardized API"](https://twitter.com/SlexAxton/status/257543702124306432)
- [Kiko Beats — Polyfill, Ponyfill & Prollyfill](https://kikobeats.com/polyfill-ponyfill-and-prollyfill/)
- [The Extensible Web Manifesto (W3C, 2013)](https://www.w3.org/community/nextweb/2013/06/11/the-extensible-web-manifesto/) · [extensibleweb/manifesto](https://github.com/extensibleweb/manifesto)
- [W3C TAG — Polyfills and the evolution of the Web](https://www.w3.org/2001/tag/doc/polyfills/)

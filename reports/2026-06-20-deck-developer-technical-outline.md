# Developer / technical deck — slide-by-slide outline

> Backlog: #1213 (parent epic #1209). The deck for developers — what WE standards actually *are* and why
> a working dev adopts or contributes. **Content only** — rendering is the dogfood epic #1210. This
> outline *selects and re-orders* the shared spine
> ([we:reports/2026-06-20-deck-narrative-spine.md](2026-06-20-deck-narrative-spine.md)); it never
> re-derives the thesis or a proof number. Beat IDs (B1–B7) and proof IDs (P-*) resolve there.
>
> **Audience profile (spine §4):** lead beat **B3** (the layered architecture); spend most on
> **B2 → B3 → B6** (the reframe → the layered surface → conformance); **de-emphasize B4 monetization**;
> headline proofs **P-SURFACE, P-NATIVE, P-CONFORM, P-POLYGLOT**; the ask is **adopt / contribute**.

---

## Arc at a glance

`B1 (fast) → B2 reframe → B3 intents → B3 blocks → B3 plugs → B3 adapters → B3 protocols → B2 native-first → B6 conformance → B7 polyglot → Ask`

The developer deck earns trust by *showing the surface*, not selling the model. B1 is a single
problem-statement slide; the body is B3 expanded one-layer-per-slide (the only deck that opens the
architecture box), with B2's native-first as the design-philosophy spine running under it. B6
conformance is the "and it's testable" payoff; B4 monetization is one passing line, not a slide.

---

## Slides

### 1 — The problem, fast (B1)
- **Claim:** every design system re-implements and re-locks the same ~80 widgets — table, select,
  router, theme — because the web never standardized the *application* layer.
- **Proof:** **P-GAP** (a re-runnable competitive gap sweep measures the hole), **P-SCALE** (80 blocks ·
  57 intents · 33 protocols is the surface that *should* be shared).
- **Depth:** one slide. Developers feel this pain already — name it and move to the answer.

### 2 — The reframe (B2)
- **Claim:** WE standardizes the **contract** a component must satisfy, not the component. You code
  against browser-aligned contracts; implementations compete underneath.
- **Proof:** **P-LOCK** (the only lock-in is an escapable protocol — impl-swappable, graceful
  degradation), **P-NATIVE** (native-first defaults).
- **Developer hook:** "write once against the contract, run on any conforming impl" — the portability
  promise, stated as an engineering guarantee.

### 3 — Layer 1: intents (B3)
- **Claim:** **intents** capture UX semantics, framework- and impl-free (UX-only, no impl refs) —
  borrowing official platform vocabulary (`aria-sort`, `Intl.Collator`) rather than inventing jargon.
- **Proof:** **P-SURFACE** (intents are a first-class entity with their own `/intents/` catalog).
- **Show:** one real intent from the catalog, its meta-schema, and that custom non-standard intents
  coexist conflict-free (the meta-schema is standardized, not the list).

### 4 — Layer 2: blocks (B3)
- **Claim:** **blocks** are the capability contracts (a CEM-described public surface + behavioral
  conformance), satisfied by an implementation — not shipped as code by WE.
- **Proof:** **P-SURFACE**, **P-NATIVE** (a native API like base-`<select>` is a registered resolver
  impl that *satisfies* the block, not a competing standard).
- **Show:** one block's contract (declared `exports` / CEM) next to a FUI impl that conforms — the
  contract↔impl seam the export-shape gate polices (#927/#1165).

### 5 — Layer 3: plugs (B3)
- **Claim:** **plugs** are the runtime-extension layer — the platform seam where capabilities attach
  (guards, validation, expression binding) without forking the impl.
- **Proof:** **P-SURFACE**.
- **Show:** the `{{ }}`/`[[ ]]` expression-binding plug (webexpressions) as a concrete runtime extension
  already shipping — proof the plug layer is real, not a slot.

### 6 — Layer 4: adapters (B3)
- **Claim:** **adapters** move both directions — *forward* (generate bindings for a runtime) and
  *reverse* (ingest an incumbent design system bottom-up into a lossy internal pivot).
- **Proof:** **P-ADAPT** (reverse — lossiness is the comparative-value signal), **P-POLYGLOT**
  (forward — runtime-agnostic reach, set up here, paid off at slide 10).
- **Show:** the adapter-as-normalization-hub idea — incumbents in, neutral contract out.

### 7 — Layer 5: protocols (B3 — the lock slide)
- **Claim:** **protocols** are the single, escapable lock — impl-swappable with graceful degradation;
  everything else (devtools, generators) is zero lock-in.
- **Proof:** **P-LOCK** (headline), **P-SURFACE** (protocols are first-class, `/protocols/` index).
- **Developer reassurance:** the one place you're "locked" is a documented, swappable protocol — and you
  can walk away with your markup intact.

### 8 — Native-first, as a discipline (B2 reprise)
- **Claim:** built-in defaults align to web-platform standards; libraries are opt-in enhancements,
  never the floor. Config extends a fully-defined platform default (flavors), tools stay default-less.
- **Proof:** **P-NATIVE** (headline).
- **Why a slide:** this is the design philosophy that makes the contracts *credible* to a skeptical
  engineer — WE isn't a framework wearing a standard's clothes.

### 9 — Conformance is mechanical (B6)
- **Claim:** "does X conform?" is a test, not an opinion — a standards gate (`check:standards`) plus
  named conformance-vector sets make conformance observable.
- **Proof:** **P-CONFORM** (headline — `check:standards` + the `deck` vector set #1195), **P-DOGFOOD**
  (the WE site / this deck render on conforming FUI components), **P-DEMOS** (120 live demos exercise
  the standards in a real browser).
- **Show, don't state:** the gate output / a passing vector run — the engineering payoff slide.

### 10 — Polyglot reach + the ask (B7)
- **Claim:** contracts are runtime-agnostic, so they reach beyond JS into .NET/Java/Go via deterministic
  forward/generation adapters (AI improves the generator at dev-time, never in the gate).
- **Proof:** **P-POLYGLOT** (headline, ratified #463), **P-ADAPT**.
- **Audience-specific ask:** **adopt / contribute.** Try a contract in your stack; add an intent, a
  conformance vector, or an adapter. Close on the one-breath thesis — *standardize the contract, not
  the code.*

---

## Selection deltas vs. the full spine arc

- **Promotes** B3 to the body — the only deck that expands the five layers one-per-slide (3–7); the
  developer room wants the architecture opened, not summarized.
- **Runs** B2's native-first as a second philosophy slide (8), under the whole B3 sequence.
- **Demotes** B4 to a single passing line (open-core is the strategic deck's #1212 center, not this
  room's) — keep the ask about *building*, not *funding*.
- **Headline proofs** P-SURFACE / P-NATIVE carry the layer + philosophy slides; P-CONFORM carries B6;
  P-POLYGLOT carries the reach/ask.

## Status

Outline delivered against the spine (#1211). Slide *rendering* is epic #1210; this is the content
selection + ordering for the developer audience. Numbers are spine-§3 references — re-pull the live
census (spine liveness note) before the deck is shown.

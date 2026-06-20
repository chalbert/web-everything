# Deck narrative spine + proof-point library

> Backlog: #1211 (parent epic #1209). The shared backbone every audience-targeted deck
> (#1212 strategic, #1213 developer, #1214 design-system) selects and re-orders from — so the
> three decks tell *one* story to three rooms, not three stories. **Content only.** Rendering /
> dogfood is the sibling epic #1210. Counts below are grounded in the live repo as of 2026-06-20.

---

## 1. The thesis (one sentence, three lengths)

- **Logline:** *Web Everything is a contracts-first standard for the whole web UI surface — so an
  app is written once against browser-aligned contracts and runs on any implementation, any
  framework, any language.*
- **Elevator (15s):** The web never standardized the *application* layer — every design system
  re-invents a table, a select, a router, a theme, and locks you in. WE standardizes the
  **contracts** (intents, blocks, plugs, adapters, protocols) instead of shipping yet another
  component library. Implementations compete; your app outlives all of them.
- **One breath:** *We standardize the contract, not the code. The contract is the only lock-in,
  and it's an escapable one.*

---

## 2. The narrative spine — the ordered beats

Every deck is a subset/re-order of these seven beats. A beat = **claim** + the **proof** that
earns it (proof IDs resolve in §3). Audience emphasis map in §4.

| # | Beat | Claim (the line) | Earns it with |
|---|------|------------------|---------------|
| **B1** | **The hole** | The web standardized documents and now layout/components primitives — but never the *application* layer. So every team rebuilds + re-locks the same 80 widgets. | P-GAP, P-SCALE |
| **B2** | **The reframe** | Stop shipping components. Standardize the **contract** a component must satisfy. Code is disposable; the contract is the asset. | P-LOCK, P-NATIVE |
| **B3** | **The architecture** | WE's contract surface is layered — *intents* (UX semantics) → *blocks* (capabilities) → *plugs* (runtime extension) → *adapters* (ingest/forward) → *protocols* (the escapable lock). One coherent system, not a grab-bag. | P-SURFACE, P-STATUTE |
| **B4** | **The constellation** | Three repos, three jobs: **WE** = the standard, **Frontier UI** = a conforming implementation, **plateau-app** = the hosted product. Clean seams, open-core by layer. | P-CONST, P-MONETIZE |
| **B5** | **It's real** | This isn't a manifesto — it's a working corpus: dozens of standards families, real demos, a conformance gate, and a governing decision record. | P-SCALE, P-DEMOS, P-RESEARCH |
| **B6** | **The proof is self-applied** | The WE site (and *this very deck*) render on FUI components conforming to WE contracts. We eat our own cooking; conformance is observable, not asserted. | P-DOGFOOD, P-CONFORM |
| **B7** | **The reach + the ask** | Contracts are runtime-agnostic, so they reach beyond JS — into .NET/Java/Go via forward adapters — and ingest incumbents via reverse adapters. [Audience-specific ask.] | P-POLYGLOT, P-ADAPT |

**Default full arc:** B1 → B2 → B3 → B4 → B5 → B6 → B7. Short decks collapse B3+B4 into one
"how it's built" beat.

---

## 3. Proof-point library (reusable evidence)

Each proof is a claim-backing unit: a **number or fact**, its **source**, and the **beats** it
serves. Re-use across decks; never re-derive a number per deck.

### Scale & maturity
- **P-SCALE** — *The corpus is large and coherent.* **40** web-standard projects · **80** blocks ·
  **57** intents · **33** protocols · **21** capabilities · **197** glossary terms.
  Source: `check:standards` census + `src/_data/`. Serves B1, B5.
- **P-STATUTE** — *Governed, not ad-hoc.* **25** named, cite-able platform statutes in
  `we:docs/agent/platform-decisions.md` (placement / naming / monetization / boundary rules) +
  **1200** tracked design items with a ratification workflow. Serves B3, B5.
- **P-RESEARCH** — *Grounded in prior art.* **138** published research topics back the contracts
  (cross-framework + native-platform surveys), not vibes. Serves B5.
- **P-DEMOS** — *It runs.* **120** live demos exercise the standards in a real browser. Serves B5, B6.

### Differentiation (why contracts, not components)
- **P-LOCK** — *The only lock-in is an escapable protocol.* Devtools = zero lock-in; protocols are
  impl-swappable with graceful degradation. Statute: *minimize-lock-in*. Serves B2, B7.
- **P-NATIVE** — *Native-first defaults.* Built-ins align to web-platform standards
  (`aria-sort`, `Intl.Collator`, base-`<select>`); libraries are opt-in enhancements, never the floor.
  Serves B2, B3.
- **P-SURFACE** — *Layered, composable surface.* intents → blocks → plugs → adapters → protocols,
  each a first-class entity with its own catalog/index. Serves B3.
- **P-GAP** — *The hole is measurable.* A re-runnable competitive gap sweep benchmarks leading design
  systems and reports what's missing — the backlog grows from evidence. Serves B1.

### Constellation & monetization
- **P-CONST** — *Three clean layers.* WE (standard, `@webeverything`, never imports FUI) → Frontier
  UI (implementation, `@frontierui`) → plateau-app (hosted product). npm scope mirrors the layer.
  Serves B4.
- **P-MONETIZE** — *Open-core by layer, disciplined.* Open = free (standards + a conforming impl);
  paid = hosting/license at the product layer. Hard rule: **cost must scale ~linearly with revenue**
  — no uncapped per-call cost inside flat pricing; pricing draws on a *structural* property
  (hosted/credential-holding), never an open-vs-proprietary line. Serves B4, B7.

### Self-proof (the dogfood)
- **P-DOGFOOD** — *We render on our own stack.* The WE docs site is being reworked to render its own
  chrome from FUI components (epic #777); this deck is the next dogfood surface (#1210). Conformance
  becomes a thing you can *watch*, not a claim. Serves B6.
- **P-CONFORM** — *Conformance is mechanical.* A standards gate (`check:standards`) + named
  conformance-vector sets (e.g. the `deck` a11y/reduced-motion set #1195) make "does X conform?" a
  test, not an opinion. Serves B6.

### Reach
- **P-POLYGLOT** — *Beyond JavaScript.* Contracts are runtime-agnostic; forward/generation adapters
  reach enterprise stacks (.NET/Java/Go) deterministically (ratified #463). Serves B7.
- **P-ADAPT** — *Ingest the incumbents.* Reverse adapters normalize existing design systems bottom-up
  into a lossy internal pivot — the lossiness *is* the comparative-value signal. Serves B7.

> **Liveness note:** §3 numbers are a 2026-06-20 snapshot. Before any deck is *shown*, re-pull the
> census (`check:standards` tail line) so no stale count ships. Track this as the deck's own
> pre-flight, not a per-slide edit.

---

## 4. Per-audience emphasis map

Same spine, different center of gravity. Each deck story is built in its own slice; this is the
selection guide.

| Audience deck | Lead beat | Spends most time on | De-emphasizes | Headline proofs | The ask |
|---------------|-----------|---------------------|---------------|-----------------|---------|
| **#1212 Strategic / vision** | B4 | B1→B2→B4 (thesis + constellation + open-core) | B3 internals | P-CONST, P-MONETIZE, P-SCALE | partner / fund / align |
| **#1213 Developer / technical** | B3 | B2→B3→B6 (contracts + layered surface + conformance) | B4 monetization | P-SURFACE, P-NATIVE, P-CONFORM, P-POLYGLOT | adopt / contribute |
| **#1214 Design-system / enterprise** | B1 | B1→B5→B6→B7 (the hole, it's real, dogfood, migration) | B2 philosophy | P-GAP, P-DOGFOOD, P-ADAPT, P-DEMOS | migrate / pilot |

---

## 5. Voice & guardrails (so all three stay on-message)

- **Lead with the reframe, not the catalog.** "We standardize the contract, not the code" before any
  feature list. Numbers (§3) *support* a claim; they are never the claim.
- **No invented jargon, no unverified numbers.** Every figure traces to §3 → a real source. If a
  number can't be pulled live, it doesn't go on a slide.
- **The lock-in line is the differentiator.** Whenever a competitor is implied, the contrast is
  *escapable protocol vs. proprietary component lock-in* (P-LOCK), not feature parity.
- **Dogfood is shown, not stated.** Prefer a live B6 moment (the deck itself) over a bullet that
  *says* "we dogfood."

---

## Status

Spine + proof library delivered. The three audience decks (#1212–#1214) now author against this
file instead of re-deriving the narrative; #1212–#1214 are unblocked (their `blockedBy: 1211`
clears on resolve). Rendering remains epic #1210.

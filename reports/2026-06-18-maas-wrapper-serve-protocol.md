# MaaS wrapper-serve protocol — prep research for decision #974

**Date:** 2026-06-18 · **For:** [#974](/backlog/974-define-the-maas-wrapper-serve-protocol-cem-framework-wrapper/) · **Status:** prepared (ready to ratify)

> Decision #974 was filed as *"define the MaaS wrapper-serve protocol — the CEM→framework-wrapper ESM
> serve contract a browser sandbox consumes."* The framing — *"that protocol is **not yet defined**"* —
> is the thing to test first. Tracing the real tree shows the **MaaS serve-path IR (`we:servePathIR.ts`,
> #505) already is that contract**: URL grammar, the `form`/`target`/`strategy` params, content-hash
> identity, immutable/floating cache, ETag/SRI, and the 400/404/500 error set are all defined and
> language-neutral. This is the same "assumed-greenfield, already-built" trap [#792 caught for the
> webexpressions binding layer]. So the prep below does **not** mint a new protocol; it reconciles the
> wrapper-serve need against the existing source of truth and isolates the one genuine residual axis.

## What #974 actually asked for, mapped to what already exists

The item lists four sub-questions. Every one maps to an existing artifact:

| #974 sub-question | Already defined in | Verdict |
|---|---|---|
| request shape: block id + target framework [+ CEM hash] | `SERVE_PATH.route = '<name>[@<pin>].js'` + `params` (`form`, `target`, `strategy`) — `we:blocks/renderers/module-service/servePathIR.ts:130-159` | name = block id; pin = the CEM hash; **framework axis = Fork A** |
| response: ESM module + content-type + cache/version headers | `MEDIA_TYPES.javascript`, `CACHE_POLICY`, `MAAS_HEADERS` (`X-MaaS-Producer`/`-Integrity`/`-Lossy`) — `we:servePathIR.ts:42-67`, `responses` at `:160-210` | covered — **supported by default** |
| how bare `react`/`vue` imports are left for the consumer to resolve | #081 native-import contract ("emit spec-clean ESM with an import-map story, no consumer build") + #955 Fork B (FUI bundler/devDep resolves the runtime) | covered — **supported by default** |
| error / 404 semantics | `responses`: 400 *"unknown form query value"*, 404 *"no such component / non-MaaS path / stale pin"*, 500 *"injected transform threw"* — `we:servePathIR.ts:160-210` | covered — **supported by default** |

**Headline:** the wire contract is done. The only thing #974 must actually decide is **how the
framework (react/vue) axis is represented in that contract** — and even that has a narrow, well-grounded
default. The card collapses from "design a protocol" to "one axis-representation fork + four
forced-invariant reconciliations."

## Grounding — the real tree

- **The serve-path IR is the polyglot SoT, not the JS handler.** `we:servePathIR.ts:1-22` — the IR is *the
  definition*; the #461 JS Fetch origin (`we:fetchHandler.ts`) is *the reference implementation, not the
  definition* (#463 fork b). It is **language-neutral, zero-import** so a code generator that never saw
  TypeScript can read it. Any new MaaS-shaped serve path conforms to this; it does not fork it.
- **The identity rule already folds the producer/transform version — and names omission as the one
  broken option.** `we:protocols.json#maas-versioning` (`we:src/_data/protocols.json:178-183`): version id =
  *content hash over EVERY byte-determining input — authored definition + **transform/compiler version**
  + params (form/target/strategy) + folded provenance … Omitting an input is the one excluded (broken)
  option — it serves drift.* So the wrapper's identity is **not** CEM-hash-only (as #974's `[+ CEM hash]`
  parenthetical implies) — it must fold the **genWrapper producer version** + framework + target, exactly
  as `X-MaaS-Producer` already carries (`we:servePathIR.ts:56`). Forced invariant.
- **The `form` param is explicitly catalog-gated and injected — value set is NOT the neutral contract.**
  `we:servePathIR.ts:88-95,138-145`: `catalogGated` forms default to the origin's value and validate
  against *an injected catalog seam — the default value + the legal set are an implementation catalog
  (injected), never the neutral contract.* This is the slot a `react-wrapper`/`vue-wrapper` value drops
  into with **zero WE contract change** (Fork A1).
- **A React "functional component + element wrapper" form ALREADY ships.** `we:moduleService.ts:33,57` —
  `ServeForm` includes `functional`, blurbed *"A React-style functional component + element wrapper;
  transpiled to ESM that imports the jsx runtime."* So serving a React wrapper as importable ESM is not
  new ground; what genWrapper adds is **vue** + a CEM-driven (vs `<component>`-derived) wrapper, both FUI
  tooling per #855.
- **genWrapper is FUI tooling producing both targets from the CEM.** `we:scripts/gen-wrapper/genWrapper.mjs`
  header (the WE copy is a *reference fixture, not a standard* — #855 B2 / #892) and `:26`
  `TARGETS = ['react', 'vue']`; it is a pure `(declaration, target) => wrapperSource` over a CEM
  `custom-element` declaration. The wrapper *renders the existing element* (consume mode, #811), not a
  reimplementation — the `@lit/react` / Stencil-output-target / Lit-Labs `gen-wrapper-*` pattern.
- **The endpoint is FUI-local; only the contract crosses the seam.** #955 ratified a FUI dev-server
  endpoint (`locus: frontierui`) consumed via `await import('/api/wrapper/<block>/<target>')`. Per the
  WE↔FUI boundary, FUI **cannot import WE's runtime** `fetchHandler` — it implements its **own** handler
  that *conforms to* the WE `servePathIR`/`maas-versioning` contract (types cross, runtime doesn't —
  #855/#817). genWrapper is injected as that endpoint's transform-provider (the same inject-a-provider
  seam `we:moduleService.ts:84-90` describes for the esbuild compiler).

## Prior art — already surveyed, synthesized here

This is **already-researched ground**; #974 sits at the intersection of five prior prep passes rather
than on virgin territory, so the web survey is *linked, not re-run* (re-running it would only confirm —
the skill's "too shallow" tell). The relevant prior art:

- **MaaS distribution family** — `/research/polyglot-maas-origin` (#463), `we:servePathIR.ts` (#505),
  `we:fetchHandler.ts` (#461): esm.sh-style ESM-over-HTTP, content-hash identity, immutable/floating cache,
  SRI — the serve mechanics the wrapper reuses verbatim.
- **`/research/we-fui-wrapper-handoff` (#855)** — the unanimous, one-directional prior art (`@lit/react`,
  Lit Labs `gen-wrapper-*`, Stencil output targets): framework wrappers are a **build-time artifact of
  the source library**, a *pure function of the CEM*. No shipping tool generates wrappers on-demand in
  the consumer — which is *why* a deterministic, content-addressed serve endpoint (not a live per-request
  compile of arbitrary input) is the right shape.
- **`/research/forward-component-emit-substrate` (#811)** — established the emit model (WC-core +
  CEM-driven wrappers; React 19 = 100% Custom-Elements-Everywhere) and, load-bearing here, *"Option W
  mints no new protocol (reuses `custom-elements-manifest`)."* Same conclusion one layer down: the serve
  path mints no new protocol either.
- **`/research/polyglot-live-test-sandbox` (#955)** — the direct parent; ratified the FUI dev-server
  endpoint that *is* this protocol's first caller, and the bundler-devDep runtime resolution that settles
  #974's "bare imports" sub-question.
- **esm.sh / `@lit/react`** — the no-build ESM serve + thin-wrapper precedents; both emit **bare
  specifiers** and lean on an import-map/bundler at the consumer, grounding the supported-by-default
  bare-specifier answer.

## Per-fork classification

- **Which layer?** Contract → **WE** (`servePathIR` / `maas-versioning` extension, if any). Endpoint
  runtime + genWrapper → **FUI** (#855/#817). Hosted serve → **plateau-app** (#091/#398). Settled.
- **Protocol or intent dimension?** Protocol (technical wire contract), and it is the **existing**
  `maas-versioning` protocol — not a new one.
- **Expose the whole axis?** The live question for Fork A: is "framework" its own axis worth a
  first-class neutral param, or a value inside the catalog-gated `form`?
- **Fixed mechanic or dimension?** Identity/cache/error are **fixed** (the protocol's invariants).
  Framework is a **dimension** (react/vue/… open-ended).
- **DI-injectable?** Yes — the form/transform is the existing injected catalog + transform-provider seam;
  genWrapper is injected on the FUI side.
- **Most-permissive default?** Bare specifiers (leave resolution to the consumer's import-map/bundler) is
  the most-permissive native-import answer — already the #081 contract.
- **Seam between intents?** No new seam; this rides the MaaS serve seam.

## The one genuine fork — how the framework axis is carried

Two coherent end-states genuinely cannot both be the single representation:

- **A1 — overload the catalog-gated `form` param** (`react-wrapper`, `vue-wrapper` as injected FUI
  catalog values; generalize/retire the React-only `functional`). **Zero neutral-contract change** — the
  IR already declares form values an injected implementation catalog. Cheapest; #974 then produces no new
  WE artifact, only a doc note that the existing IR covers the wrapper case + the FUI catalog
  registration.
- **A2 — add a distinct neutral `framework` param to `servePathIR`** (alongside `form`/`target`/
  `strategy`). Framework (react/vue/svelte…) is **orthogonal** to *form* (thin-wrapper vs full-rewrite
  #818 vs wc-class) and to the ES-version *target*. Encoding it inside `form` collapses two axes into one
  enum — the `form × framework` explosion (`react-wrapper`, `vue-wrapper`, later `react-full`,
  `vue-full`, `svelte-wrapper`…). A first-class param keeps the catalog clean and is what the #507
  generation-adapter / polyglot reach wants from a first-class framework axis. Touches #506/#507 (a
  neutral-contract change), but adds the **param** (neutral), not the **values** (still injected).

**Recommended default: A2 (neutral `framework` param), ~65%.** On *merit* (not cost — cost is
prioritization, #465): framework and form are distinct axes, the existing React-only `functional` form is
the accidental-conflation precedent A2 *cleans up* (form=wrapper, framework=react), and WE's standing
bias is separate-and-expose-the-whole-axis. **Residual / red-team hook:** A1 is fully coherent and
cheaper, the IR author deliberately kept value-sets out of the neutral contract (so "add a param for 2
frameworks" risks over-engineering / YAGNI), and the `functional` precedent shows framework-in-form has
worked. This is the high-leverage fork — **flag for the deciding agent's skeptic pass.** The fork's
answer also decides whether #974 yields any WE artifact at all (A1 → none; A2 → one IR param +
#506/#507 follow-through).

## Synthesis handed to #974

One genuine fork (framework-axis representation, default A2 ~65%, flag for skeptic) + four forced-invariant
reconciliations: (1) conform to / extend the existing `servePathIR` — do **not** mint a parallel protocol;
(2) identity = the `maas-versioning` content-hash rule incl. the **genWrapper producer version**, not
CEM-hash-only; (3) cache = `CACHE_POLICY` (immutable on hash-pin, 302 on floating); (4) errors =
`SERVE_PATH.responses` (400 unknown framework/form, 404 no block, 500 generator threw) + bare-specifier
ESM with import-map resolution left to the consumer (#081/#955). The FUI endpoint is its **own** handler
conforming to the WE contract (runtime never crosses the seam), genWrapper injected as its transform.

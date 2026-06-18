---
type: decision
workItem: story
size: 5
status: open
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
preparedDate: "2026-06-18"
relatedReport: reports/2026-06-18-maas-wrapper-serve-protocol.md
researchTopic: maas-wrapper-serve-protocol
relatedProject: webadapters
parent: "746"
tags: [maas, polyglot, block-explorer, protocol]
---

# Define the MaaS wrapper-serve protocol (CEM→framework-wrapper ESM serve contract)

The #955 ruling builds [#912](/backlog/912-polyglot-panel-live-test-sandbox-execute-the-generated-wrapp/)'s
live-test sandbox on a FUI dev-server endpoint that runs `genWrapper(cem, target)` + transpile and serves
a ready ESM module the browser consumes via plain `await import('/api/wrapper/<block>/<target>')`. At
ratification this raised: that endpoint's request/response shape **is** a MaaS wrapper-serve protocol, and
it "is not yet defined" — so #912 was gated on this item.

> **Prep finding — the premise is false; the contract already exists.** The prior-art pass
> ([research topic](/research/maas-wrapper-serve-protocol/) ·
> [report](../reports/2026-06-18-maas-wrapper-serve-protocol.md)) traces the real tree and finds the MaaS
> **serve-path IR already is this contract** — the same "assumed-greenfield, already-built" trap #792
> caught for the binding layer. `we:blocks/renderers/module-service/servePathIR.ts` (ratified #505/#463) is a
> language-neutral, zero-import source of truth defining the URL grammar, the `form`/`target`/`strategy`
> params, content-hash identity, immutable/floating cache, ETag/SRI headers, and the 400/404/500 error
> set — and a React *"functional component + element wrapper"* form **already ships**
> ([`we:moduleService.ts:33,57`](../blocks/renderers/module-service/moduleService.ts#L33)). So #974 does
> **not** mint a new protocol. It reconciles the wrapper-serve need against the existing one, leaving
> exactly **one genuine fork** (how the framework axis is carried) + four forced-invariant
> reconciliations.

## Every sub-question maps to an existing artifact

| #974 sub-question | Already defined in | Status |
|---|---|---|
| request: block id + framework [+ CEM hash] | [`we:servePathIR.ts:130-159`](../blocks/renderers/module-service/servePathIR.ts#L130) — `route '<name>[@<pin>].js'` + `params` (`form`/`target`/`strategy`) | name = block id; pin = CEM hash; **framework = Fork A** |
| response: ESM + content-type + cache/version headers | [`we:servePathIR.ts:42-67`](../blocks/renderers/module-service/servePathIR.ts#L42) — `MEDIA_TYPES`, `CACHE_POLICY`, `MAAS_HEADERS` (`X-MaaS-Producer`/`-Integrity`/`-Lossy`) | **supported by default** |
| bare `react`/`vue` import resolution | #081 native-import contract (spec-clean ESM + import-map, no consumer build) + #955 Fork B (FUI bundler/devDep resolves the runtime) | **supported by default** |
| error / 404 semantics | [`we:servePathIR.ts:160-210`](../blocks/renderers/module-service/servePathIR.ts#L160) — 400 unknown form, 404 no component/non-MaaS path/stale pin, 500 transform threw | **supported by default** |

## The axis

The seam is a *MaaS serve path*, and that serve path is **already the polyglot source of truth**:
[`we:servePathIR.ts:1-22`](../blocks/renderers/module-service/servePathIR.ts#L1) — the IR is *the
definition*; the #461 JS Fetch origin (`we:fetchHandler.ts`) is *the reference implementation, not the
definition* (#463 fork b). The identity rule is fixed by
[`we:protocols.json#maas-versioning`](../src/_data/protocols.json#L178): the version id is a content hash
over *every* byte-determining input — definition + **transform/compiler version** + params + provenance —
and *"omitting an input is the one excluded (broken) option."* genWrapper
([`we:scripts/gen-wrapper/genWrapper.mjs:26`](../scripts/gen-wrapper/genWrapper.mjs#L26), `TARGETS =
['react','vue']`) is FUI tooling (#855), injected as the endpoint's transform-provider via the existing
inject-a-provider seam ([`we:moduleService.ts:84-90`](../blocks/renderers/module-service/moduleService.ts#L84)).
The only axis the existing contract does **not** already settle is **how the framework (react/vue) is
named** in the request — everything else is a forced-invariant reuse.

### Recommended path at a glance

| Fork | Options (**bold** = recommended default) | Main alternative & why weaker | Confidence |
|---|---|---|---|
| **A — framework-axis representation** | **A2 — add a neutral `framework` param to `servePathIR`** · A1 — overload the catalog-gated `form` param | A1 is *coherent* (zero neutral-contract change, cheaper) so it's a real either/or; A2 wins on merit (framework ⊥ form ⊥ target — A1 collapses two axes into one enum), cleaning up the accidentally React-only `functional` form | ~65% |

## Supported by default (forced invariants — not forks)

Each names no excluded-yet-coherent alternative; the alternative is *broken*, so these ratify rather than
fork:

1. **Conform to / extend the existing `servePathIR` — do NOT mint a parallel protocol.** A second
   MaaS-shaped contract duplicates the #505 SoT and serves drift between two contracts. The FUI endpoint
   is a new **reference caller** of the existing contract (the #461 vite-plugin is the existing caller).
2. **Identity folds the genWrapper producer version**, not CEM-hash-only — `maas-versioning` makes
   omission *the* broken option; #974's "[+ CEM hash]" parenthetical is under-specified. Surfaced via
   `X-MaaS-Producer` + ETag/SRI, exactly as today.
3. **Cache = `CACHE_POLICY`** — `immutable` on a hash-pin, `302` on a floating pin.
4. **Errors = `SERVE_PATH.responses`** — 400 unknown framework/form · 404 no such block / non-MaaS path /
   stale pin · 500 generator threw. **Bare-specifier ESM** (`import 'react'`) emitted spec-clean;
   import-map/bundler resolution left to the consumer (#081 + #955 Fork B — a #912 build detail).
5. **FUI endpoint is its own runtime conforming to the WE contract** — the WE→FUI boundary forbids FUI
   importing WE's runtime `fetchHandler`; only the type-only IR/contract crosses (#855/#817). FUI
   implements a handler that *conforms to* `servePathIR`/`maas-versioning`.

## Fork A — how the framework (react/vue) axis is carried

*Fork-existence: A1 and A2 genuinely cannot coexist — a request names its framework in exactly one place.
Both are coherent end-states (A1 changes nothing in the neutral contract; A2 adds one neutral param), so
this is a real either/or, not a forced invariant.*

- **A2 — add a distinct neutral `framework` param to `servePathIR` (recommended default, ~65%).**
  Framework (react/vue/svelte…) is **orthogonal** to *form* (thin-wrapper vs full-rewrite #818 vs
  wc-class) and to the ES-version *target*. Encoding it inside the `form` enum collapses two axes into one
  — the `form × framework` explosion (`react-wrapper`, `vue-wrapper`, later `react-full`, `vue-full`,
  `svelte-wrapper`…). A first-class param keeps the injected catalog clean and is what the #507
  generation-adapter / polyglot reach wants from a framework axis. It adds the **param** (neutral), not
  the **values** (still an injected implementation catalog). On merit this is the cleaner end-state — and
  it *cleans up* the accidentally React-only `functional` form (which becomes `form=wrapper`,
  `framework=react`). The cost (touching the #506 vectors and #507 adapter) is **prioritization, not
  merit** (#465) — filed to the build, not a reason to pick A1.
- **A1 — overload the catalog-gated `form` param** (`react-wrapper`/`vue-wrapper` as injected FUI catalog
  values). **Zero neutral-contract change** — the IR explicitly declares `form` values *"an
  implementation catalog … never the neutral contract"*
  ([`we:servePathIR.ts:88-95`](../blocks/renderers/module-service/servePathIR.ts#L88)), so this is purely a
  FUI catalog registration and #974 then yields **no WE artifact at all**. **Residual / red-team hook:**
  A1 is fully coherent and cheaper, the IR author *deliberately* kept value-sets out of the neutral
  contract (so "add a param for two frameworks" risks YAGNI/over-engineering), and the existing
  `functional` form is precedent that framework-in-form works. **This is the high-leverage call — flag
  for the deciding agent's skeptic pass;** its answer also decides whether #974 produces a WE artifact
  (A1 → none; A2 → one IR param + #506/#507 follow-through).

## Constellation placement (settled)

Contract → **WE** (`servePathIR`/`maas-versioning`, extended only under A2). Endpoint runtime +
genWrapper → **FUI** (#855/#817). Hosted serve → **plateau-app** (#091/#398). #974's eventual artifact
is therefore either a one-line doc note (A1) or a single neutral IR param (A2) — not a new protocol.

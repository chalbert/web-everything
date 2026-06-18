---
type: decision
workItem: story
size: 5
status: resolved
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
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

> **RATIFIED A1 (2026-06-18, ~80%) after the deciding-agent skeptic pass — flipped from the prep's A2 default. See
> "Red-team finding" below.** The prep's A2 default rested on a conformance/polyglot argument that *inverts* on
> inspection: a WE conformance gate consumes the catalog-gated *seam* (in-catalog→200, unknown→400), not the framework
> *value* — WE has no React oracle — so a `framework` param earns **zero** incremental WE-conformance over riding the
> existing `form` param, and fails the #817 admission test. Ruling is **deliberately provisional** — start now, collect
> experience, revisit later (standing review = #978; FUI catalog follow-up = #977).

| Fork | Options (**bold** = recommended default) | Main alternative & why weaker | Confidence |
|---|---|---|---|
| **A — framework-axis representation** | **A1 — overload the catalog-gated `form` param** (`react-wrapper`/`vue-wrapper` as injected FUI catalog values) · A2 — add a neutral `framework` param to `servePathIR` | A2's orthogonality argument (framework ⊥ form) is real but **mis-placed** — it argues for a 2-D *catalog structure inside FUI*, never a 2-D *param surface in WE*; legislating it across the `we:servePathIR.ts:23` neutrality seam violates WE=contracts-only / minimize-lock-in. `framework=react` is the most JS-ecosystem-specific value imaginable → a *catalog value*, less neutral than `form`, not a contract role. A2 survives only as coherent-but-weaker. | ~80% |

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

## Red-team finding (deciding-agent skeptic pass) — RATIFIED A1 (~80%, 2026-06-18)

The prep flagged A1 for a skeptic pass; the skeptic landed and the default flips. Three legs:

1. **The conformance-consumption argument inverts (decisive).** A WE conformance gate consumes the catalog-gated
   *seam* — `form` is `catalogGated` with an unknown-value→400 rule validated against an *injected* catalog
   ([`we:servePathIR.ts:88-95,178-183`](../blocks/renderers/module-service/servePathIR.ts#L88)) — **not** the framework
   *value*. WE has no React/Vue oracle, so it can never assert "this output is valid React" under *either* option. A
   #506 vector tests framework-serving through `form=react-wrapper` exactly as well as through `framework=react`
   (inject the value → assert 200 + media-type; assert an un-injected value → 400). So a neutral `framework` param earns
   **zero** incremental WE-gate consumption and fails the #817 admission test (the #817 placement rule). The prep's "A2
   makes the polyglot axis WE-conformanceable" is false — the conformanceable surface (in-catalog→200/unknown→400) is
   *identical* across A1/A2.
2. **Orthogonality is real but mis-placed.** `react-wrapper` vs `react-full` (same framework, different form) vs
   `react-wrapper` vs `vue-wrapper` (same form, different framework) *is* a 2-D matrix. But that matrix lives entirely
   in the **FUI injected catalog**, never in the WE neutral contract — FUI is free to model its catalog as a
   `{framework, form}` tuple internally and encode it on the wire as one opaque `form` string. WE has no standing to
   legislate FUI's catalog factoring; mandating a `framework` param to "tidy" it pushes a value-set-shaping opinion
   across the `we:servePathIR.ts:23` neutrality seam the IR was *built* to keep value-sets out of (WE=contracts-only /
   minimize-lock-in).
3. **Polyglot reach (#463/#507) cuts *toward* A1, not A2.** `framework=react`/`vue` is the most JS-ecosystem-specific
   value imaginable; a generated .NET/Blazor or Go origin would route on its *own* dialect catalog, never on
   `framework=react`. The neutral role is `form` (output dialect); the values (`react-wrapper`, `vue-sfc`,
   `blazor-razor`…) are per-origin catalog. Baking `framework` into the neutral SoT makes it *less* neutral. The
   generation-adapter consumes the param-set + dispatch rules, and catalog-gated dispatch works identically whether
   framework rides `form` or a separate param — so even generator-consumption doesn't earn the param its slot.

**The `functional`-cleanup is fork-neutral** (the prep credited it only to A2): A1 *also* cleans up the accidentally
React-only `functional` form — by replacing it with consistent catalog values `react-wrapper`/`vue-wrapper`. The cleanup
is a FUI catalog reorg either way, filed to the #912 build.

### Ruling (A1) — RATIFIED 2026-06-18

> **Follow-ups:** FUI catalog registration → **#977** (`react-wrapper`/`vue-wrapper` form values, retire `functional`).
> Standing deferred experience review → **#978** (parked; collects cases before any A2 revisit). #912 now unblocks
> (its `blockedBy` swaps #974 → #977).

Framework rides the **existing catalog-gated `form` param** as injected FUI catalog values (`react-wrapper`/
`vue-wrapper`), replacing the React-only `functional`. The five forced invariants stand unchanged. **#974 mints no new
WE artifact** — it is a *reconciliation ruling* (wrapper-serve conforms to the existing `servePathIR`/`maas-versioning`)
plus a FUI catalog-registration note. The #506-vector / #507-adapter follow-through the prep attributed to A2
**evaporates**. #912 unblocks with zero new contract surface.

**Explicitly provisional — a deliberately under-committed protocol.** We are *not* freezing the wrapper-serve shape
here; it is too early to commit the neutral contract fully and there is no value in waiting to start. A1 is partly
chosen *because* it is the minimal-commitment path: it keeps `servePathIR` at its current `version: '1.0.0'` shape and
lets the framework value-set accumulate in FUI's cheap-to-change **injected catalog**, where reshaping costs nothing.
The job now is to **collect real experience** building #912 / #507 against this seam and let that experience — not
speculation — tell us whether a genuine neutral `framework` param (A2) is ever warranted. The escape hatch is built in:
if forward-adapter routing later proves it needs a first-class framework axis, we promote it then as a deliberate,
versioned `servePathIR` bump (`1.0.0 → 1.1.0`), with the experience to justify the surface. Per
the ratified-decisions-are-reversible principle, record this ruling with lineage and treat it as fully
revisable — it is closer to the soft/revisitable end than a frozen standard.

*Residual (~20%): a stakeholder could read #463's polyglot charter as wanting `framework` named in the neutral contract
for forward-adapter routing ergonomics. Argued above to be backwards (framework is a JS-specific catalog value), but
that's the one place A2 stays alive — and the provisional framing above is exactly how we keep that door open.*

## Worked examples (A1 — framework rides the catalog-gated `form` value)

Concrete request/response traces against the existing grammar
([`we:servePathIR.ts`](../blocks/renderers/module-service/servePathIR.ts)). Base path `/_maas/`, route
`<name>[@<pin>].js`, params `form` (catalog-gated) · `target` (ES version) · `strategy`. These are illustrative and
**provisional** — refine as #912 surfaces real cases.

**Ex.1 — first hit, floating (no pin) → `302` down the pin ladder.** The framework is just a `form` catalog value;
no separate param appears on the wire.

```http
GET /_maas/date-picker.js?form=react-wrapper&target=es2022
→ 302 Found
Location: /_maas/date-picker@sha256-Ab3x...9Qk.js?form=react-wrapper&target=es2022
Cache-Control: public, max-age=60, must-revalidate         # CACHE_POLICY.floating
X-MaaS-Producer: genWrapper@1.4.0+esbuild@0.21.5           # folded into the identity hash (maas-versioning §3)
```

**Ex.2 — follow the terminal hash pin → `200`, immutable ESM.** Bare specifiers are emitted spec-clean; the consumer's
import-map / bundler resolves `react/jsx-runtime` (#081 + #955 Fork B — a #912 build detail, not this contract).

```http
GET /_maas/date-picker@sha256-Ab3x...9Qk.js?form=react-wrapper&target=es2022
→ 200 OK
Content-Type: text/javascript; charset=utf-8
Cache-Control: public, max-age=31536000, immutable          # CACHE_POLICY.immutable
ETag: "sha256-Ab3x...9Qk"
X-MaaS-Integrity: sha256-Ab3x...9Qk                         # SRI over the served bytes
X-MaaS-Producer: genWrapper@1.4.0+esbuild@0.21.5

import { jsx as _jsx } from 'react/jsx-runtime';
import { DatePicker as DatePickerElement } from '/_maas/date-picker@sha256-7f1c...02d.js?form=wc-class';
export function DatePicker(props) { /* thin wrapper over the custom element */ }
```

**Ex.3 — same block, Vue → a *different* artifact id.** `form=vue-wrapper` is byte-distinct from `form=react-wrapper`,
so its content hash (hence pin and ETag) differs. The two frameworks are two catalog values, never two params.

```http
GET /_maas/date-picker.js?form=vue-wrapper&target=es2022
→ 302 Found
Location: /_maas/date-picker@sha256-C4d2...mN0.js?form=vue-wrapper&target=es2022
```

**Ex.4 — framework not in the injected catalog → `400`.** This is the catalog-gated 400 the WE conformance gate (#506)
asserts — value-set-blind, identical whether the value is `svelte-wrapper` or any other unknown `form`.

```http
GET /_maas/date-picker.js?form=svelte-wrapper
→ 400 Bad Request
Content-Type: application/json; charset=utf-8
{ "error": "unknown form 'svelte-wrapper'", "known": ["wc-class","react-wrapper","vue-wrapper"] }
```

**Ex.5 — conditional revalidation on a pin → `304`.** Lets a long-lived client confirm an immutable artifact cheaply.

```http
GET /_maas/date-picker@sha256-Ab3x...9Qk.js?form=react-wrapper
If-None-Match: "sha256-Ab3x...9Qk"
→ 304 Not Modified
ETag: "sha256-Ab3x...9Qk"
```

**Ex.6 — lossy transform is surfaced, never silent (#081).** A `500` is reserved for the injected transform *throwing*;
a partial/lossy emit still serves `200` but flags it.

```http
GET /_maas/date-picker@sha256-Ab3x...9Qk.js?form=vue-wrapper&target=es2015
→ 200 OK
X-MaaS-Lossy: 1
X-MaaS-Diagnostic: es2015%20target%20dropped%20a%20top-level%20await%20%7C%20slotted%20default%20coerced
```

## Constellation placement (settled)

Contract → **WE** (`servePathIR`/`maas-versioning`, extended only under A2). Endpoint runtime +
genWrapper → **FUI** (#855/#817). Hosted serve → **plateau-app** (#091/#398). #974's eventual artifact
is therefore either a one-line doc note (A1) or a single neutral IR param (A2) — not a new protocol.

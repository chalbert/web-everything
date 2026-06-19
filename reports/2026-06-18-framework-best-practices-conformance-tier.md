# Framework best-practices conformance tier — idiomatic React/Vue lint axis for generated wrappers

**Date**: 2026-06-18
**Point**: Prep research for decision #976 (the third graded-conformance tier ratified by #913, under Block Explorer epic #746). Surveys the idiom-lint prior art (eslint-plugin-react/vue, React 19's forwardRef→ref-prop shift, the WCAG/ARIA-AT severity model) and lands the genuine residual on **two** forks — the *shape* of the WE-owned criteria contract (engine-neutral catalog vs. executable ESLint ruleset) and the *verdict nature* (advisory severity-graded vs. binary pass/fail) — with everything else collapsing to forced invariants inherited from #913/#899 + a Config-Extends-Platform-Default open criteria registry.
**Research page**: `/research/framework-best-practices-conformance-tier/`

---

## Question

#913's resolution ratified a **graded, multi-dimensional** conformance model for the Block Explorer polyglot panel: three honestly-labelled tiers, each catching a different failure class —

1. **Surface-contract** (deterministic, no sandbox; wrapper exposes the props/events/slots the CEM declares) → #975
2. **Framework best-practices** (idiomatic React/Vue) → **#976 (this decision)**
3. **Behavioral identity** (live mount, fire events, assert state vs vectors) → #967

The lint axis (tier 2) was *absent from the original survey* — #913 spawned #976 to decide its criteria set and tool. The question: **what does "idiomatic-framework conformance" check, how does WE own the criteria, and what verdict does the badge render** — given idiom-linting is unlike behavioral conformance (it is static source-pattern matching, deeply tied to AST tooling) and idioms *change* (React 19 deprecated `forwardRef`)?

## Grounding in the real tree (verified)

The genWrapper emitters are the subject of the lint axis. Both verified in `fui:tools/gen-wrapper/genWrapper.mjs`:

- **React emitter (`reactWrapper`, lines 74–144):** event-prop naming is already idiomatic — `eventHandlerName` (line 38) maps `change` → `onChange`. **But it does NOT expose a ref to the host element**: it creates its *own* internal `useRef` (line 130) and never forwards it — so neither the pre-19 `forwardRef` idiom nor the React-19 `ref`-as-prop idiom is satisfied. The `useEffect` has **no dependency array** (lines 132–137), so it re-runs every render. These are exactly the idiom gaps tier 2 targets.
- **Vue emitter (`vueWrapper`, lines 147–193):** mostly idiomatic — `defineComponent`, typed `props` (`{ type: String, required: false }`, line 156), explicit `emits: [...]` array (line 181). Misses **emit validators** (the array form satisfies `vue/require-explicit-emits` but not `vue/require-emit-validator`), and `vuePropCtor` (lines 64–71) is best-effort (defaults to `String`).
- **WE already ingests linters into a neutral pivot:** `we:scripts/validation-normalize/adapters/eslint.mjs` + `we:scripts/validation-normalize/adapters/oxlint.mjs` normalize incumbent linter configs into a neutral form (the adapter-as-normalization-hub pattern) — evidence WE treats linters as *ingestable incumbents over a neutral contract*, never as the standard itself.

## Prior art surveyed

1. **React 19 deprecates `forwardRef`** ([react.dev/blog/2024/12/05/react-19](https://react.dev/blog/2024/12/05/react-19)). `ref` is now a regular prop on function components; `forwardRef` still works for back-compat but is no longer the idiom. **A hardcoded "must use forwardRef" criterion would be _wrong_ against React 19** — proof that idioms shift, so the criteria contract must be versioned/extensible and the verdict advisory, not a frozen MUST-gate. React 19 also added first-class custom-element support (primitives render as attributes, etc.).
2. **eslint-plugin-vue** ([eslint.vuejs.org](https://eslint.vuejs.org/)) is the authoritative Vue idiom source: `vue/require-prop-types` (props specify at least a type), `vue/require-explicit-emits` (declare emitted events — matters because Vue 3 attribute-fallthrough makes undeclared `v-on` listeners fall through as native listeners), `vue/require-emit-validator` (typed emit declarations). The genWrapper Vue output passes the first two, misses the third.
3. **eslint-plugin-react / typescript-eslint** are the React-side idiom authorities (hooks-deps, event-handler naming, ref handling). These are **ESLint-AST-coupled** — idiom checks are fundamentally static source-pattern matching, *unlike* behavioral conformance (#899) which is observable runtime behavior and engine-neutral by nature.
4. **Severity model — WCAG (A/AA/AAA), ARIA-AT priority tiers, ESLint (error/warn/off).** The established pattern for SHOULD-level / best-practice criteria is a **severity-graded, non-blocking** signal, not a binary pass/fail gate. Idioms are SHOULD-level (legitimate alternatives exist), so the conformance literature consistently grades rather than gates them.
5. **custom-elements-everywhere.com** scores frameworks *behaviorally*, not by lint — confirming the idiom tier is a genuinely *separate* axis from #967's behavioral one, catching a different (style/maintainability) failure class.

## Recommendation (handed to #976)

**Forced invariants (inherited — ratify, not weigh):**
- **Ownership decomposition** — criteria/catalog → WE, lint runner → FUI, hosted multi-implementer exerciser → Plateau. Inherited verbatim from #913's resolution + #899 + the constellation-placement statute. Not re-decided.
- **Honesty rule** — the badge is labelled precisely "best-practices"/"idiomatic", never a bare "conformance". Inherited from #913.
- **Distinct tier** — idiom quality ≠ surface contract (#975) ≠ behavior (#967). Ratified by #913.

**Supported by default (not decisions):**
- **The criteria _set_ is an open registry** (Config-Extends-Platform-Default, not a "which rules" fork): default-less core + a platform-flavor default {React: host-ref exposure, event-prop `on*` naming, hooks-deps; Vue: `require-prop-types`, `require-explicit-emits`, `require-emit-validator`}. Projects extend/override.
- **The lint _engine_ (ESLint + eslint-plugin-react/vue vs. a bespoke AST checker) is a FUI impl choice** — WE mandates nothing (mandate-nothing). "Reuse an existing linter?" is FUI's call; "reuse is cheaper" is *prioritization*, never a fork branch.

**Two genuine forks (the real residual):**
- **Fork 1 — shape of the WE criteria contract: engine-neutral criterion catalog (recommended, ~70%) vs. executable ESLint ruleset.** WE owns a normative, engine-neutral *catalog* of named idioms (id + rationale + per-framework applicability + severity), and FUI maps each id to a concrete check. Shipping an executable ESLint plugin *as the WE standard* bakes a JS-only AST engine into a contract → lock-in, cuts #855/#817. Residual: if a neutral catalog proves too vague to drive a real checker without AST encoding, the ESLint-ruleset branch's concreteness wins — high-leverage, flag for skeptic.
- **Fork 2 — verdict nature: advisory severity-graded score (recommended, ~75%) vs. binary pass/fail gate.** Idioms are SHOULD-level; a hard "fails idiom = non-conformant" over-claims (honesty-rule failure) and ossifies against idiom drift (React 19). A severity-graded score (ESLint/WCAG model) degrades trivially to binary if wanted; the reverse doesn't.

## Files Created/Modified

| File | Action |
|---|---|
| `we:reports/2026-06-18-framework-best-practices-conformance-tier.md` | created (this report) |
| `we:src/_data/researchTopics.json` | added `framework-best-practices-conformance-tier` entry |
| `we:src/_includes/research-descriptions/framework-best-practices-conformance-tier.njk` | created (write-up) |
| `we:backlog/976-framework-best-practices-conformance-tier-idiomatic-react-vu.md` | rewritten to prepared-fork shape; `preparedDate` set |

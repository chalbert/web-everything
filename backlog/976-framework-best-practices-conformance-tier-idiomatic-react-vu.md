---
type: decision
workItem: story
size: 5
parent: "746"
status: resolved
blockedBy: []
dateOpened: "2026-06-18"
dateStarted: "2026-06-18"
dateResolved: "2026-06-18"
graduatedTo: none
codifiedIn: "docs/agent/platform-decisions.md#constellation-placement"
preparedDate: "2026-06-18"
locus: frontierui
relatedProject: webdocs
relatedReport: reports/2026-06-18-framework-best-practices-conformance-tier.md
tags: [webdocs, block-explorer, polyglot, conformance, lint, idiomatic]
---

# Framework best-practices conformance tier — idiomatic React/Vue lint axis for generated wrappers

The third graded-conformance dimension ratified by [#913](/backlog/913-polyglot-panel-per-target-conformance-badges-from-the-determ/)
(the lint axis, absent from the original survey), under Block Explorer epic [#746](/backlog/746-block-explorer/).
It judges *framework-idiom quality* of genWrapper output — distinct from the surface-contract
([#975](/backlog/975-surface-contract-conformance-tier-deterministic-generated-wr/)) and behavioral
([#967](/backlog/967-polyglot-panel-behavioral-wrapper-conformance-badge-fui-side/)) tiers. **No design exists
yet for the criteria contract or verdict shape.** The forks below are grounded in a prior-art survey
published as the `/research/` topic
[`framework-best-practices-conformance-tier`](/research/framework-best-practices-conformance-tier/) (session
report in `relatedReport`); each carries a recommended default in **bold**. Ownership and the honesty rule
are **inherited from #913/#899/constellation-placement, not re-decided** (see *Forced invariants* below).

## The axis (grounded)

The subject is the genWrapper emitters, verified in `fui:tools/gen-wrapper/genWrapper.mjs`. Idiom-linting
is *static source-pattern matching* — fundamentally unlike #967's engine-neutral *behavioral* conformance,
and unlike #975's *semantic surface* check. The concrete idiom gaps in today's output:

- **React** (`reactWrapper`, lines 74–144): event-prop naming is idiomatic (`eventHandlerName`, line 38:
  `change` → `onChange`), but the wrapper **exposes no host ref** — it keeps its own internal `useRef`
  (line 130) and never forwards it, failing *both* the pre-19 `forwardRef` idiom and the React-19
  `ref`-as-prop idiom — and the `useEffect` has **no dependency array** (lines 132–137).
- **Vue** (`vueWrapper`, lines 147–193): mostly idiomatic (`defineComponent`, typed `props` line 156,
  explicit `emits: [...]` line 181) but misses **emit validators** (`vue/require-emit-validator`);
  `vuePropCtor` (lines 64–71) is best-effort.
- WE already ingests incumbent linters via an adapter —
  [we:scripts/validation-normalize/adapters/eslint.mjs](scripts/validation-normalize/adapters/eslint.mjs)
  + [we:scripts/validation-normalize/adapters/oxlint.mjs](scripts/validation-normalize/adapters/oxlint.mjs)
  — evidence WE treats linters as ingestable incumbents, never as the standard. **Corrected (skeptic
  pass, verified):** that adapter's model is `{ rule, severity, enabled }` where `rule` is the **raw
  ESLint rule-id string passed straight through** (`vue/require-emit-validator`); it normalizes
  *severity encoding* only and does **not** abstract the rule identity. So it is evidence the neutral
  pivot *keeps* the ESLint rule id as its primitive — which argues *against* a fully engine-neutral
  catalog whose neutrality is the point, and *for* the **A′** landing below (catalog + a subordinate
  reference ruleset), not standalone-A.

The two axes that need a human call are the **shape of the WE-owned criteria contract** (engine-neutral vs.
ESLint-shaped) and the **verdict nature** (advisory-graded vs. binary gate). Everything else collapses to
forced invariants or an open registry — see below the divider.

## Recommended path at a glance

| Fork | Recommended default | Main alternative (excluded) | Confidence |
| --- | --- | --- | --- |
| 1 — shape of the WE criteria contract | **A′ — engine-neutral catalog + subordinate reference ESLint ruleset** (amended from standalone-A by the skeptic pass) | B — executable ESLint ruleset *as the WE standard* | Med (~70%) |
| 2 — verdict nature | **A — advisory, severity-graded score** | B — binary pass/fail gate (symmetric with #975/#967) | Med-high (~75%) |

> **Ratified 2026-06-18 — see *Resolution* below.** Fork 2 → A as prepared. Fork 1 → **A′**: the skeptic
> pass (verified against the real tree) landed the prepared red-team residual, so the standalone-A
> default is amended to A′ (catalog stays the WE-owned authority and the engine stays swappable; a
> normative reference ESLint ruleset rides *subordinate* to the catalog as the executable disambiguator,
> per the #461/#463 reference-impl-not-the-definition pattern). B-as-the-standard stays excluded.

## Fork 1 — Shape of the WE-owned criteria contract: engine-neutral catalog vs. executable ESLint ruleset

**Why it's a fork (case b — genuine either/or):** the WE-owned criteria artifact is *one* contract and can
be only one of these — an engine-neutral *catalog of what's checked* or an executable *ESLint config/plugin*;
they cannot both be "the standard." The choice determines whether the contract is engine-agnostic or
JS-AST-locked.

**Crux (grounded above):** idiom checks are AST-coupled (eslint-plugin-react/vue, typescript-eslint), unlike
#899's behavioral vectors which are engine-neutral by nature — so it is genuinely tempting to ship the
ESLint ruleset *as* the criteria. But that bakes a JS-only engine into a contract meant to be
implementer/engine-agnostic.

**Options:**

- **A — WE owns an engine-neutral criterion catalog. ✅ recommended (~70%).** A normative list of named
  idioms — each with `id` + rationale + per-framework applicability + severity — engine-neutral (the
  WCAG-SC / ARIA-AT criterion-list shape, and the shape WE's own validation-normalize pivot already uses).
  FUI maps each criterion `id` to a concrete check (an eslint-plugin-react/vue rule, or a bespoke AST
  check). *Merit:* only the catalog crosses the WE→FUI seam; the engine stays swappable (minimize-lock-in);
  mirrors #899 (meaning→WE, runner→FUI) and #855 ("only the contract crosses the seam, code never does").
- **B — WE ships an executable ESLint shareable-config/plugin as the standard.** *Rejected as the WE
  contract:* it puts runnable JS-AST runtime in the standard layer (cuts #817 "runtime→FUI" and #855
  "generator/tool→FUI"), and locks the criteria to ESLint for no interop gain — a non-ESLint or
  future-polyglot runner can't consume it. The ESLint plugin is legitimate **FUI impl** (the runner's
  concrete realization of catalog A), not the standard.

**Per-fork classification.** Layer: the *catalog* defines a conformance contract → WE; the *runner/plugin*
delivers a capability at runtime → FUI (*impl-is-not-a-standard*; #817 "a running handler is impl"). Not a
new protocol (no multi-vendor interop contract minted — it's a criterion list, like the behavioral vectors).
Not an intent dimension. Seam: #700 (WE↔FUI) — under A only the catalog crosses, the clean placement.

**Red-team note for the deciding agent.** The genuine residual: can idiom criteria be expressed *neutrally*
enough to drive a real checker, or are they irreducibly AST-pattern-shaped? If a neutral catalog proves too
vague without an AST encoding (so FUI's mapping becomes the real spec and the catalog is decorative), B's
concreteness is the honest call — then WE owns a *reference* ESLint ruleset as a fixture subordinate to the
catalog (the #461 "reference impl, not the definition" pattern), not as the lock. **High-leverage — flag for
a skeptic sub-agent pass.**

## Fork 2 — Verdict nature: advisory severity-graded score vs. binary pass/fail gate

**Why it's a fork (case b — genuine either/or):** the badge renders *one* verdict shape; a hard pass/fail
gate and an advisory graded score cannot both be "the badge." And a binary "fails idiom = non-conformant"
over-claims a SHOULD-level concern — the exact honesty-rule failure #913 flagged — so the binary branch is
*flawed for this tier specifically* (unlike #975/#967, which gate MUST-level contract/behavior).

**Crux (grounded above):** idioms are SHOULD-level — legitimate alternatives exist, and they *shift*: React
19 **deprecated `forwardRef`**, so a hardcoded "must use forwardRef" MUST-gate would now be wrong. The
conformance literature grades SHOULD-level criteria (WCAG A/AA/AAA, ARIA-AT priorities, ESLint
error/warn/off) rather than gating them.

**Options:**

- **A — advisory, severity-graded score. ✅ recommended (~75%).** Each criterion carries a severity
  (error/warn/info, ESLint model); the badge surfaces a score or "N advisories", never a blocking
  "conformant" verdict. *Merit:* honors the inherited honesty rule (it *is* best-practices, advisory by
  nature); robust to idiom drift (a deprecated idiom drops to `info`/`off` without breaking a gate);
  degrades trivially to binary if a project wants a threshold.
- **B — binary pass/fail gate, symmetric with #975/#967.** *Rejected as default:* a stylistic SHOULD
  blocking a build over-claims (the honesty-rule violation), and a hard gate ossifies against idiom drift.
  Symmetry with the two MUST-tiers is a UX-consistency argument, not a merit one — and a graded score can
  *present* as a single badge anyway. (If the project later wants a hard threshold, it's a config over the
  graded score, not a different verdict model.)

**Per-fork classification.** Layer: the verdict-shape is part of the WE criteria contract (what a result
*means*) → WE defines it; the runner that produces it → FUI. Fixed mechanic vs. dimension: the severity
*model* is fixed; the per-criterion severity *values* live in the open registry (Fork-adjacent, see
*Supported by default*). Most-permissive default: advisory (A) is the least-restrictive — a gate is the
author's opt-in threshold, never the default.

---

## Resolution — ratified 2026-06-18

**Fork 2 → A (advisory, severity-graded score).** As prepared, unattacked. Idioms are SHOULD-level and
they *shift* (React 19 deprecated `forwardRef`), so a binary "fails idiom = non-conformant" gate
over-claims (the honesty-rule failure #913 flagged) and ossifies against drift. Each criterion carries an
ESLint-model severity (error/warn/info); the badge surfaces a score / "N advisories", never a blocking
"conformant" verdict. Degrades trivially to a binary threshold as a *project config over* the graded
score — never the default verdict model (most-permissive default). Confidence ~75%.

**Fork 1 → A′ (engine-neutral catalog + subordinate reference ESLint ruleset), amended from
standalone-A.** A skeptic pass — flagged high-leverage by the item's own red-team note — landed the
prepared residual ("can idiom criteria be expressed neutrally enough to drive a real checker, or are they
irreducibly AST-pattern-shaped?"). Its tree-grounded refutation, **verified here**:

- The concrete criteria are AST-pattern identities, not substrate-independent invariants the way #899's
  behavioral vectors are. `vue/require-emit-validator` *is* an `eslint-plugin-vue` rule id; "expose a host
  ref" is un-statable without naming `forwardRef`/`ref`-prop; "useEffect dependency array" is
  `react-hooks/exhaustive-deps`. "Idiomatic React" has no referent *apart from* React's AST conventions —
  unlike behavior, which is observably the same across engines.
- The evidence the prepared item cited for neutrality cuts the other way: [we:scripts/validation-normalize/adapters/eslint.mjs](scripts/validation-normalize/adapters/eslint.mjs)
  keeps the **raw ESLint rule-id as its model primitive** (`{ rule, severity, enabled }`), normalizing
  severity only. WE's real neutral pivot does *not* abstract rule identity.
- A standalone catalog therefore risks being **decorative**: if it can't adjudicate ambiguous wrappers
  (`useImperativeHandle` partial-forward; `Ref<unknown>` vs `Ref<HTMLElement>`), FUI's private AST mapping
  becomes the de-facto spec while the WE artifact floats above it — the exact "mapping is the real spec"
  failure the residual named.

**The landing is the third option the prepared red-team note scoped and declined to default to**, not
bare B. WE owns the catalog (ids, rationale, per-framework applicability, severity) **and** a normative
**reference ESLint flat-config that is the executable disambiguator** — *subordinate* to the catalog per
the **#461/#463 reference-impl-not-the-definition** pattern (the contract is the authority; when a future
non-ESLint runner and the reference config disagree, the catalog's intent governs and the reference config
is fixed). This survives the statutes: a reference/fixture config is a **conformance reference artifact**
(like #899's vectors + reference runner, like #463's deterministic reference), authored as data WE ships
as the canonical worked answer — *not* a mandated runtime. **B-as-the-WE-standard stays excluded**
(shipping a runnable ESLint *plugin as the standard* would put JS-AST runtime in the standard layer,
cutting #817/#855, and ESLint-lock the contract). The lint *engine* remains a FUI impl choice
(mandate-nothing); the reference config is a fixture, not the mandated runner. Confidence ~70%; residual:
Fork-2's advisory verdict lowers the *cost* of any catalog under-determination (a vague criterion yields a
soft advisory, not a wrong gate) — it does not cure the neutrality claim, which is why A′ (not standalone-A)
is the honest landing.

**Build-time acceptance gate (carried into the graduation chain).** The **substitutability test**: a
criterion's WE artifact *drives* the check (not merely labels it) iff two independent runners — the
reference ESLint mapping and a bespoke AST check — return the **same verdict** on a deliberately ambiguous
wrapper corpus, each justified by the catalog text + reference config. Divergence ⇒ the criterion is
under-determined and the catalog/reference pair must be tightened.

**Forced invariants** (ownership decomposition, honesty label, distinct tier) ratified as inherited, not
re-weighed. **Disposition:** #976 (the decision) resolves; the graduation chain below becomes agent-ready
(spawned as separately-prioritized builds). Reversible (re-open if a neutral catalog proves it can drive
the checks without the reference config — collapsing A′ back toward standalone-A — or if the tier is
descoped).

## Context

### Forced invariants — ratify, not weigh (inherited, not re-decided here)

1. **Ownership decomposition.** Criteria/catalog → WE; lint runner → FUI; hosted multi-implementer
   exerciser → Plateau. Inherited verbatim from [#913](/backlog/913-polyglot-panel-per-target-conformance-badges-from-the-determ/)'s
   resolution + [#899](/backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida/)
   + [constellation-placement](../docs/agent/platform-decisions.md#constellation-placement). *Broken branch:*
   a runner inside `@webeverything`, or a bespoke FUI-only suite as the authoritative home — both already
   excluded by #817/#899.
2. **Honesty rule.** The badge is labelled precisely **"best-practices"/"idiomatic"**, never a bare
   "conformance". Inherited from #913. *Broken branch:* a "conformance" label promising a guarantee the
   tier doesn't verify.
3. **Distinct tier.** Idiom quality ≠ surface contract (#975) ≠ behavior (#967) — a different failure
   class. Ratified by #913.

### Supported by default (not decisions)

- **The criteria _set_ is an open registry**, not a "which rules" fork (Config-Extends-Platform-Default):
  a default-less core + a platform-**flavor** default — React: host-ref exposure (`forwardRef` pre-19 /
  `ref`-prop React 19), event-prop `on*` naming, hooks-deps; Vue: `require-prop-types`,
  `require-explicit-emits`, `require-emit-validator`. Projects extend/override; the flavor holds the
  sensible default. (This is *why* Fork 2 defaults to graded — a versioned/extensible set needs
  per-criterion severity, not one global gate.)
- **The lint _engine_ is a FUI impl choice** (mandate-nothing): ESLint + eslint-plugin-react/eslint-plugin-vue,
  or a bespoke AST checker — WE mandates none. "Reuse an existing linter?" is FUI's call; "reuse is cheaper"
  is *prioritization*, never a fork branch (it is the realization of Fork 1's catalog, whichever way Fork 1
  lands).

### Relationships

- **Parent:** epic [#746](/backlog/746-block-explorer/) (Block Explorer).
- **Spawned by:** [#913](/backlog/913-polyglot-panel-per-target-conformance-badges-from-the-determ/) (the
  graded-model ruling).
- **Sibling tiers:** [#975](/backlog/975-surface-contract-conformance-tier-deterministic-generated-wr/)
  (surface-contract) · [#967](/backlog/967-polyglot-panel-behavioral-wrapper-conformance-badge-fui-side/)
  (behavioral).
- **Ownership precedent:** [#899](/backlog/899-behavioral-conformance-vectors-in-browser-implementer-valida/)
  (vectors→WE / runner→FUI / exerciser→Plateau) ·
  [#855](/backlog/855-decide-the-we-fui-wrapper-handoff-mechanism-for-the-polyglot/) (only the contract
  crosses the seam).

### Graduation (after the call)

A ratified ruling yields agent-ready builds via a `blockedBy` chain in composition order: WE criterion-catalog
schema + the flavor default set **+ the subordinate reference ESLint flat-config (the executable
disambiguator, A′)** → FUI runner (engine of FUI's choice, mapping each criterion id to a check; passes the
substitutability test against the reference config) → the FUI-workbench "best-practices" badge consuming the
advisory severity-graded verdict (Fork 2 = A) → (later) the Plateau hosted exerciser tier. *Which* tiers
build when is separate prioritization. If the runner exposes a documented technical setting (e.g. engine
selection, severity threshold), spin a Technical Configurator card per the prepared-fork-shape rule.

# Research Report — Form Validation Standard: Assessment, Philosophy & Interop Design

**Date**: 2026-05-30
**Scope**: Where the form-validation standard stands, the philosophy landscape that governs it, an
exhaustive UX pattern catalog, and the proposed design — validation as an *interop vocabulary* composed
from cross-cutting meta-intents.
**Companion**: implementation roadmap and live decision register in the working plan
(`~we:/.claude/plans/help-me-improve-form-dapper-manatee.md`); spec-versioning workstream in
`we:reports/2026-05-30-validation-spec-versioning-adherence.md`.

---

## 1. Where we stand (starting point)

The standard spanned two `draft` layers:

- **Validation Intent** (`we:src/_data/intents.json`) — a solid skeleton: four dimensions (`context`,
  `level`, `execution`, `visibility`), lifecycle events (`enter`/`exit`/`pulse`), and a `ValidationIntent`
  interface. **Missing** the `loader`-style research fields (`designSystemResearch`, `uxResearch`,
  `researchGaps`).
- **Validation Block** (`fui:blocks.json` + `we:block-descriptions/validation.njk`) — an 18-line stub: registry
  entry held only `id/name/status/type/summary/implementsIntent`; description had three bullet "Key
  Concepts" (Constraint Integration, State Reflection, Message Standardization). No webStandards, traits,
  events, or API.
- **Glossary** — a "Validation" term exists ("the lifecycle of data integrity checking, error message
  placement, and submission blocking").

| Layer | Status | Substance | Biggest gap |
|---|---|---|---|
| Intent | `draft` | Strong dimensions + interface | No design-system / UX research grounding |
| Block | `draft` | 18-line stub | No webStandards/traits/events/API |
| Glossary | — | Core term present | Sub-terms missing |

**Framing decision:** Web Everything is *not* a form framework. Its value is an **interop contract** — a
project declares its UX intents, then configures whatever engine it likes underneath. If every control,
group, and form speaks the same vocabulary of **intents + states + events**, implementations from
different creators become swappable and combinable. So the work is *vocabulary-first*, not
implementation-first.

---

## 2. The three philosophy axes

Form validation is hard because several genuinely competing philosophies govern it. Three independent
research threads (framework architecture, rule definition, UX timing/severity) converged on three
orthogonal axes.

### Axis A — Architecture: event-driven/imperative ↔ state-derived/reactive

- **Event-driven/imperative:** an event fires → run a validator → *imperatively set/clear* an error in a
  mutable bag. (React Hook Form — uncontrolled refs + proxy subscriptions, gated by
  `mode`/`reValidateMode` — [RHF FAQ](https://www.react-hook-form.com/faqs/).)
- **State-derived/reactive:** validity is a *pure derivation* of values + meta-state; no `setError`.
  (Solid memos — [createMemo](https://docs.solidjs.com/reference/basic-reactivity/create-memo);
  Svelte [`$derived`](https://svelte.dev/docs/svelte/$derived); Vue/Vuelidate computed.)
- **Angular is the instructive "both":** the *truth* is state-derived (`FormControl` carries
  `VALID`/`INVALID`/`PENDING`), the *interface* is event-driven (`statusChanges`/`valueChanges`
  Observables — [Angular FormControl](https://angular.dev/api/forms/FormControl)). The poles describe
  *interface style, not underlying truth*.
- **Platform:** `ValidityState`/`:invalid` is the always-derived truth;
  [`ElementInternals.setValidity()`](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/setValidity)
  is the one imperative seam that enrolls a custom element into the derived engine.

**Load-bearing insight:** *timing-of-computation* and *timing-of-display* are **separable** concerns.
Naive designs fuse them; reactive libraries separate them (compute continuously, gate display on
touched/dirty/submitted); the platform separates them too — `:invalid` (always) vs
[`:user-invalid`](https://developer.mozilla.org/en-US/docs/Web/CSS/:user-invalid) (only after
interaction — [web.dev](https://web.dev/articles/user-valid-and-user-invalid-pseudo-classes)). The
intent already encodes this split as two axes — `execution` (compute) vs `visibility` (display).

### Axis B — Rule definition: native ↔ schema-first ↔ imperative ↔ bridging

| Approach | Source of truth | Native UI | Cross-field/async | Cost |
|---|---|---|---|---|
| Native HTML constraints (CVAPI) | the DOM | ✅ localized, submit-gating, `:invalid` | only via `setCustomValidity` glue | fixed vocabulary |
| Schema-first (Zod/Yup/Valibot, **Standard Schema**) | one schema | ❌ render yourself | first-class | vendor coupling |
| Imperative field-level (Angular `Validators`) | scattered | ❌ | hoist to group/form | dispersed logic |
| **Bridging (recommended)** | schema → native validity | ✅ reuses native | schema owns logic | two models to sync |

[Standard Schema](https://standardschema.dev/) is a zero-runtime TS interface (`~standard` →
`validate(value) → {value}|{issues:[{message,path}]}`, async-capable) co-designed by Zod/Valibot/ArkType
authors; tRPC and TanStack Form already consume it. **Targeting the `~standard` interface, not a vendor,
gives schema-agnostic interop.** Native has *no async/pending state* — Angular models it explicitly
(`PENDING`), and stale-resolve races are recurring
([RHF #1688](https://github.com/react-hook-form/react-hook-form/issues/1688)).

**Recommendation — bridge-by-default:** native validity model (`setValidity`) as the universal
output/gating/a11y sink; Standard Schema as the vendor-neutral rule input; a form/group orchestration
layer owning async + cross-field + conditional logic.

### Axis C — UX timing, placement, severity, a11y

- **"Reward early, punish late"** ([Konjević](https://medium.com/wdstack/inline-validation-in-forms-designing-the-experience-123fb34088ce)):
  clean field validates lazily (on blur); once errored, flips to eager (on change) so the message clears
  the instant it's fixed; reverts on valid. **A dynamic flip**, not a single mode — a flat
  `execution: change|blur|submit` enum can't express it.
- **GOV.UK disagrees with the inline camp**: mandates submit-only, warns blur/live *raised* error rates
  ([GOV.UK validation](https://design-system.service.gov.uk/patterns/validation/)); USWDS deprecated its
  own inline component. ⇒ timing must be configurable, per-field.
- **`:user-invalid`/`:user-valid`** (Baseline Oct 2023) = the native encoding of the display gate; maps
  to `visibility: touched|submitted`. `visibility: dirty` has *no* native pseudo-class.
- **GOV.UK dual model (gold standard):** on failure show **both** a top-of-form error summary
  (`role=alert`, focus-moved-on-submit, anchor links to first errored field/member) **and** inline
  messages (`aria-describedby`, visually-hidden "Error:" prefix), with **verbatim parity**
  ([Error summary](https://design-system.service.gov.uk/components/error-summary/)).
- **Severity is beyond binary, but native is strictly binary** — CVAPI/`:invalid`/`aria-invalid` have no
  "warning." So `warning`/`caution`/`info` are inherently beyond-native: advisory-only, must *not* set
  `aria-invalid`.
- **A11y → WCAG:** `aria-invalid` + `aria-describedby` (3.3.1, A); suggest the fix (3.3.3, AA); confirm
  high-stakes submits (3.3.4, AA); dynamic errors need a live region present on load.

### Axis D — Async Resolution Strategy: Cancellation vs. Versioning

**Problem:** Async validators race. If a validator runs for input V1, then user types V2 before V1 completes, the V1 result (stale) can overwrite V2's (correct) result. Both React Hook Form ([RHF #1688](https://github.com/react-hook-form/react-hook-form/issues/1688)) and Final Form ([#420](https://github.com/final-form/react-final-form/issues/420)) track this as a recurring critical bug.

**Solution:** Choose a strategy for detecting and rejecting stale results. Two equally valid approaches exist; the choice is a conformance concern, not a UX concern. Web Everything supports both via the `CustomValidatorResolutionRegistry` plug.

#### Strategy 1: Cancellation (native-first, recommended default)

| Aspect | Detail |
|--------|--------|
| **Mechanism** | When input changes, cancel in-flight validators via `AbortController`. Stopped validators never produce results. |
| **Signature** | `validator(value, signal)` — validator accepts an `AbortSignal` and checks `signal.aborted` or passes it to fetch/async operations. |
| **Pros** | Matches user intent ("they changed their mind"). Resource-efficient (stops wasted API calls). Web standard (`AbortController`). Simple semantics: latest input always wins. |
| **Cons** | Requires validators to accept a `signal` parameter. Legacy validators (pre-AbortController era) need refactoring. |
| **Best for** | New code, async-capable validators, internal implementations. Aligns with platform (fetch, AbortController). |
| **Example** | `const result = await fetch('/validate', { signal }); // abort stops the request` |

#### Strategy 2: Versioning (pragmatic integration)

| Aspect | Detail |
|--------|--------|
| **Mechanism** | Tag each validation run with a generation/version token. When a validator completes, check: is this version still current? If old, drop result. If current, apply it. |
| **Signature** | `validator(value)` — no signature change. Registry handles version tracking. |
| **Pros** | Works with existing validators without refactoring. No signature change needed. Integrates third-party libraries easily (Zod, Yup, custom validators). |
| **Cons** | Less efficient (validators complete unnecessary work). Requires explicit version checking in result handler. Mental model: old results are dropped, not prevented. |
| **Best for** | Legacy code, third-party validators, framework constraints (e.g., Formik/Final Form validators that predate AbortController). Teams integrating multiple libraries. |
| **Example** | `const result = checkServer(value); if (result.version !== currentVersion) return; // drop stale` |

#### Decision Framework

Choose **cancellation** if:
- You're starting a new validation system from scratch.
- Your validators use async/await with fetch or other AbortController-aware APIs.
- You want to minimize resource waste and follow web platform conventions.

Choose **versioning** if:
- You're integrating with legacy form libraries (Formik, Final Form) that don't support AbortController.
- You have third-party validators you can't modify.
- Your validators do expensive work that's already started (e.g., database query) — you'd rather finish and discard than interrupt.
- Your team's existing code patterns use mutable version counters or timestamp-based invalidation.

#### Registry Pattern in Web Everything

Both strategies are registered via `CustomValidatorResolutionRegistry` (a plug):

```typescript
// Define the provider interface
interface CustomValidatorResolution {
  startValidation(fieldId, input): ValidationHandle;
  shouldApplyResult(handle, result): boolean; // true if result should be applied
  onInputChange(fieldId, newInput): void; // clean up old work
}

// Register strategies (e.g., in app bootstrap)
window.customValidatorResolution.register('cancellation', new CancellationResolver());
window.customValidatorResolution.register('versioning', new VersioningResolver());

// App selects which strategy via injector
const resolver = injector.get('customValidation:async-resolution');
// Or at form level:
const formValidator = createFormValidator({
  asyncStrategy: injector.resolve('customValidatorResolution').getProvider('cancellation')
});
```

**Teams can:**
- Set a **default strategy globally** (app bootstrap).
- **Override per-form** (e.g., legacy form uses versioning, new form uses cancellation).
- **Chain strategies** (verify cancellation, fall back to versioning).
- **Implement a custom strategy** for non-standard scenarios (rate limiting, batch validation, etc.).

**Recommendation for WE standards:** Cancellation is the native-aligned default. Versioning is a first-class alternative, not a workaround — teams choosing it have legitimate constraints.

---

## 3. Exhaustive UX Pattern Catalog (~70 deduplicated)

Mined from ten design systems, ARIA APG / W3C WAI, and the docs + issue trackers of nine form libraries.

### Control
*Timing:* on-submit · on-blur · on-change/live · onTouched · reward-early/punish-late · debounced ·
per-field-mode override · re-validate-mode · validate-first. *Severity/display:* error · warning
(non-blocking) · success · info · pending/validating · error-replaces-helper · icon+color · hidden
"Error:" prefix · live character counter · helper/hint · required indicator · "mark the minority"
suffix. *Async:* uniqueness check · pending spinner · gate-async-behind-sync · cancellation. *Imperative:*
manual setError · clear-error · reportValidity. *Rules:* min/max/length/pattern · transform/coerce.
*A11y/native:* aria-invalid · describedby vs errormessage · `:user-invalid` · setCustomValidity ·
ElementInternals.setValidity + anchor · willValidate exclude.

### Group
fieldset/legend (or role=group/radiogroup) · single group error · composite control (date d/m/y,
address) · cross-field/dependent · revalidate-dependents-on-change · conditional/required-if (reactive) ·
conditional schema (discriminated union, path placement) · dynamic add/remove validators · group async ·
multi-bullet requirements · anchor-to-first-errored-member · optgroup.

### Form
error summary at top · focus-to-summary on submit · summary links jump to field · "There is a problem"
heading · order by field order · verbatim inline↔summary parity · "Error:" page-title prefix ·
validate-on-submit · preserve entered data · novalidate · server validation + reconcile · root/global
error · toast (anti-pattern) · hybrid timing · record-level validation · meta aggregation · dirty vs
baseline · async defaults · reset/reinitialize · server error injection · optimistic+rollback · submit
awaits async · partial submit/draft · focus+scroll to first error (sticky-offset) · don't-disable-submit ·
live-region announce · region-must-exist-on-load · role=alert semantics · polite-vs-assertive · retain
values (3.3.7) · accessible auth (3.3.8) · error prevention (3.3.4/3.3.6) · review-and-confirm.

### Nested-form
field arrays (add/remove/reorder, errors track rows by key) · array touched/dirty · outer-vs-inner error
bleed · validate single nested path · nested object schemas · multi-step wizard per-step validation ·
back-nav value retention · field-level async inside array · progress-indicator step error · return to
prior step · optional-step indication · nested fieldset grouping · per-section error heading · cross-step
redundant-entry carryover · per-step error prevention.

### ⚠ Cross-cutting hard requirements (the real find)

Issue-tracker research showed two root causes behind nearly every hard bug:

1. **Async needs a generation/version token** — an async result must be *discarded if the input changed
   since dispatch.* Every "stale resolve clobbers a newer error" bug
   ([RHF #1688](https://github.com/react-hook-form/react-hook-form/issues/1688),
   [Final Form #420](https://github.com/final-form/react-final-form/issues/420)) is this.
2. **Validity needs a deterministic merge order** between sync / async / manual-setError / schema /
   warning sources. Every "server error wiped on blur," "schema overwrites my error," "root toggles
   isValid" bug ([Formik #706](https://github.com/jaredpalmer/formik/issues/706),
   [RHF #9982](https://github.com/react-hook-form/react-hook-form/issues/9982)) is undefined precedence.

Plus: pending aggregation + "submit awaits in-flight async"; a declarative `dependsOn` graph; an explicit
**baseline** separate from current value; live-region-on-load; per-control focus anchor.

### Interop conflicts the standard must let projects choose
- **Timing default:** GOV.UK submit-only (discourages live) vs Carbon on-blur vs Ant on-change.
- **Required signaling:** asterisk vs "mark the minority" suffix.
- **Native vs custom:** GOV.UK disables HTML5 validation; Material/Salesforce lean on CVAPI.

---

## 4. The interop design (vocabulary + DI + conformance)

### Three planes
1. **Intents** — the UX contract (states/events/behaviour), computation-agnostic.
2. **Registries** — the form decomposed into swappable concerns (change detection, dirty-check value
   comparison, inter-element comms, validity computation, async orchestration, message resolution,
   display/placement, focus/anchor).
3. **Injectors** — DOM-tree DI (`injector.set('customValidation:dirtyCheck', impl)` /
   `InjectorRoot.getProviderOf(...)`, nearest-provider-wins) so a concern is set app-wide or overridden
   per subtree.

**Conformance is observable-contract, never computation** — state-derived and event-driven engines both
conform iff observable states/events match.

### Control statechart — four parallel regions
- **Validity** — a *reduction over named sources* (`native`/`schema`/`async`/`manual`), each
  `idle|valid|invalid|pending{version}`, merged by a **declared precedence**. The `pending{version}`
  token discards stale async (req #1); the declared merge prevents source-overwrite (req #2). This makes
  both root-cause bugs structurally impossible.
- **Interaction** — `pristine↔dirty` (vs explicit baseline), `untouched↔touched`, `focus`, `submission`
  — these gate *display*, not *compute*.
- **Commit** — `committed`/`rejected`/`held`, derived from validity × `level`.
- **Display** — `silent`/`showing-{error,warning,success,info,pending}`, gated by `visibility`;
  reward-early/punish-late falls out here as a policy, not a new `execution` value.

### Composition up the hierarchy
Group/form/nested compose via uniform aggregation (pending if any descendant pending → invalid if any
invalid → valid). Form adds the submission sub-statechart + GOV.UK error summary; nested adds bubbling
policy (`participating`/`isolated`), key-based array identity, and wizard step-gating (which formalizes
the Workflow block's `withGateValidation`).

### Inter-concern hand-off contracts
Canonical shapes (`ValueSnapshot`, `SourceResult`, `MergedValidity`, `InteractionState`,
`DisplayDecision`) flow between concerns. **The event-driven ↔ state-derived choice collapses into just
two concerns — change detection + inter-element comms; the other seven are pure transforms identical in
both architectures.** That contains the state-derived adoption problem to two well-bounded seams.

### Conformance tiers
- **L0 Intent-aware** — honours the UX intents.
- **L1 State & event conformant** — presents the observable states + emits stable-id events → makes
  implementations **swappable**.
- **L2 Shape & concern conformant** — hand-off shapes normative + concerns DI-replaceable → makes
  concerns **combinable** across creators.

### Capability model (orthogonal to tiers)
Features (`async`, `cross-field`, `conditional`, `field-array`, `wizard`, `error-summary`, `severity`,
`schema`, `server-reconciliation`) are optional, trait-like bundles. Implementations publish a capability
manifest `{specVersion, conformanceLevel, features[], concerns{}}`; partial compliance is first-class as
long as out-of-capability usage is *detectable and reported*, not silent. (Tooling: see companion report.)

### Stable-id scheme
Atoms get dot-path ids rooted in the `validation` *domain* (not the intent entry):
`validation.dim.<dimension>.<value>`, `validation.<level>.<region>.<state>`, `validation.<level>.<event>`,
`validation.source.<name>`, `validation.concern.<name>`, `validation.feature.<name>`. Append-only, never
renamed — so re-categorization (or a later intent split) never breaks cross-references.

---

## 5. Validation as composition of cross-cutting meta-intents

The pivotal finding: several "validation atoms" are universal concerns the repo already models (and
fragments). Validation should *compose* them, not redefine them.

| Meta-concern | Existing home(s) | Resolution |
|---|---|---|
| **Async/pending lifecycle** | `loader` (events `idle/pending/success/error/stale`, `timing: debounced`), `action.busy`, `Resource Action` | `loader` **already is** the async-lifecycle meta. Validation **composes** it. Strengthen loader with an explicit **version token** (it has `stale` but no version model) + **aggregation**. |
| **Messaging severity/tone** | `feedback.severity` (info/success/warning/error), `message.tone` (neutral/positive/caution/negative), `validation.level` (error/warning/caution/info) | Severity is **triplicated**. Unify into **one severity/tone vocabulary**; `validation.level` = that axis + a commit-policy overlay. |
| **Message placement** | `feedback.placement` (spatial: top-end…) vs `validation.context` (relational: control/group/form/root) | **Orthogonal axes — do not unify.** A message has a relational anchor and (if floating) a spatial placement. |
| **Error outcome** | `reliability` (tolerance/recovery/fallback) | Two **distinct error families**: *input-invalidity* (validation core — an expected outcome) vs *operation/mechanism failure* (composes `reliability`). Conflating them is a category error. |

**Reframe:** validation = a *validation-specific core* (rule computation, interaction meta-state, commit
policy, submission gating, hierarchy aggregation) that **composes** the pending meta (loader), the
messaging severity vocabulary, and the error/outcome meta (reliability). This is the WE composition vision
paying off — strengthening the shared metas benefits every consumer (toasts, data fetching, API error
handling), not just forms.

---

## 6. Recommendations / next actions

1. **Materialize, don't keep planning.** Distribute the design into real docs (this report; the
   meta-intents; the validation intent; glossary; block; spec-versioning brief) and refine in place.
2. **Adopt the working resolutions:** compose `loader` for pending (strengthen it); unify the triplicated
   severity vocabulary; split input-invalidity from operation-failure; bridge-by-default with Standard
   Schema as rule input; reward-early/punish-late as a display policy.
3. **Keep the binary-native rule explicit:** only `level: error` gates submit / sets `aria-invalid`.
4. **Treat the capability/versioning layer as a separate workstream** (companion report).

### Open decisions (live register in the plan)
The largest are: validity-as-source-reduction vs flat flag; conformance-tier granularity; the timing
default (must stay configurable); and the meta-intent factoring scope (touches `loader`/`feedback`/
`message`/`reliability`). These travel with the docs as inline 🔶/⚠ notes.

---

## Next Steps

### Phase 1: Materialization (✅ Complete)
All design decisions have been distributed into real documentation and intents:
- Assessment report (this document) — exhaustive UX catalog, philosophy landscape, interop design
- Spec-versioning brief (companion report) — capability manifests, adherence detection tooling
- Validation Intent (`we:src/_data/intents.json`) — expanded with per-level vocabulary, conformance tiers, features, research fields
- Glossary (`we:src/_data/semantics.json`) — 10 new validation-specific terms
- Block reference (`fui:src/_data/blocks.json`, `we:validation.njk`) — reframed as conformance reference with traits and events
- Research topic — "Validation as Composition of Meta-Intents" documenting the pattern that validation composes shared metas (Loader, Messaging, Reliability)

### Phase 2: Adapter Implementations (Pending)
Prove conformance tiers by building L1 and L2 implementations:

**L1 adapters** (state + event conformant; swappable):
- React Hook Form adapter — surface merged validity, interaction state, events; use standard-schema for rules
- Angular FormControl adapter — bridge existing FormControl observables to stable-id events
- Solid createSignal adapter — pure-function validity composition

**L2 reference implementation** (shape + concern conformant; combinable):
- Vanilla-JS validation block demonstrating all 8 decomposed concerns as injectable providers
- Example swaps: custom dirty-check (deep vs strict), custom async orchestration (debounce vs queue)

**Research goal:** Prove that an app can swap dirty-check concern app-wide OR override display-placement concern for a subtree, with all implementations remaining conformant.

### Phase 3: Spec Versioning & Adherence Tooling (Pending)
Implement the side-project brief:
- `check:validation-adherence` build-time check (sibling to `check:standards`): diff declared capability manifest vs atoms/features actually used in markup/config
- Runtime dev-mode guard: warn/throw on out-of-capability usage (using atom from absent feature, emitting event for unsupported tier)
- Adherence report format: human + machine readable (tier achieved, features present/absent, gaps, spec-version compatibility)
- Test fixtures: deliberately partial implementations that prove gaps are reported clearly

### Phase 4: Generalization (Future)
Apply the composition pattern to other standards requiring optional features + cross-cutting concerns:
- Catalog meta-intents (Loader, Messaging, Reliability, …) as a living taxonomy
- Document composition as a design pattern in the codebase
- Build tooling to detect duplication (e.g., "multiple severity vocabularies detected")

---

## Open Points Register

Extracted from the design plan. 🔶 = DECIDE (awaits your call). ⚠ = CONFLICT (must stay configurable or you pick). ✅ = SETTLED (decided).

| ID | Flag | Point | Status |
|----|------|-------|--------|
| OP-1 | 🔶 | **Validity model: reduction vs flat flag.** Source-reduction is more robust; flat is simpler. | Drafted reduction; awaits confirmation. |
| OP-11 | 🔶 | **Conformance definition & tiers.** Proposed L0/L1/L2 model. | Proposed & documented in Intent. Awaits confirmation. |
| OP-18 | 🔶 | **Core (mandatory) features.** Proposed: control validity (error), interaction, display, native source. | Documented in Intent. Awaits confirmation. |
| OP-19 | 🔶 | **Capability manifest location.** Where does an impl publish `{specVersion, level, features, concerns}`? | Options: static export, element property, injector provider. Side-project specifies. |
| OP-22 | ✅ | **Meta-intent factoring: now vs cross-reference.** | **SETTLED**: Factor now (completed this session). Validation composes Loader/Feedback/Message/Reliability. |
| OP-23 | ✅ | **Pending/busy unification.** Validation composes Loader's async lifecycle, not redefined. | **SETTLED**: Completed. Loader enhanced with version token + aggregation. |
| OP-24 | ✅ | **Messaging unification.** Unify severity vocabulary; keep placement axes separate. | **SETTLED**: Completed. One severity/tone vocabulary across Feedback/Message/Validation. |
| OP-25 | ✅ | **Input-invalidity vs mechanism-failure.** | **SETTLED**: Completed. Validation owns input-invalidity; Reliability owns mechanism-failure. |
| OP-21 | ✅ | **Input status boundary (OP-21).** Redefine as rendering Validation's DisplayDecision. | **SETTLED**: Completed. Input glossary updated; one source of truth for field state. |
| OP-2 through OP-20 | 🔶/⚠ | **Implementation details.** Group visited rollup, cross-field error attachment, form submission UX, wizard gating, etc. | Refinable during adapter builds. Flag as needed. |

---

## Primary sources

- **Native:** [Constraint Validation API](https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Constraint_validation) ·
  [ValidityState](https://developer.mozilla.org/en-US/docs/Web/API/ValidityState) ·
  [ElementInternals.setValidity](https://developer.mozilla.org/en-US/docs/Web/API/ElementInternals/setValidity) ·
  [`:user-invalid`](https://developer.mozilla.org/en-US/docs/Web/CSS/:user-invalid) ·
  [web.dev :user-*](https://web.dev/articles/user-valid-and-user-invalid-pseudo-classes)
- **Rule definition:** [Standard Schema](https://standardschema.dev/) ·
  [Parse, don't validate](https://lexi-lambda.github.io/blog/2019/11/05/parse-don-t-validate/) ·
  [Zod](https://zod.dev/api) · [Angular FormControlStatus](https://angular.dev/api/forms/FormControlStatus)
- **UX/a11y:** [Konjević — reward early, punish late](https://medium.com/wdstack/inline-validation-in-forms-designing-the-experience-123fb34088ce) ·
  [GOV.UK Error summary](https://design-system.service.gov.uk/components/error-summary/) ·
  [GOV.UK validation pattern](https://design-system.service.gov.uk/patterns/validation/) ·
  [NN/g error messages](https://www.nngroup.com/articles/error-message-guidelines/) ·
  [WCAG 3.3.3 Error Suggestion](https://www.w3.org/WAI/WCAG21/Understanding/error-suggestion.html) ·
  [ARIA APG Alert](https://www.w3.org/WAI/ARIA/apg/patterns/alert/)
- **Form-lib hard cases:** [RHF #1688](https://github.com/react-hook-form/react-hook-form/issues/1688) ·
  [RHF #9982](https://github.com/react-hook-form/react-hook-form/issues/9982) ·
  [Formik #706](https://github.com/jaredpalmer/formik/issues/706) ·
  [Final Form #420](https://github.com/final-form/react-final-form/issues/420) ·
  [Angular #13200](https://github.com/angular/angular/issues/13200)

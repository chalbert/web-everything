# Progress Report — 2026-02-22

## Summary

Completed six work streams: (1) resource-related block spec expansion, (2) resource-router integration, (3) plans review, (4) workflow block spec, (5) framework adapters analysis, and (6) transient component spec.

---

## 1. Resource-Related Block Specs (Plan: composed-hopping-yao)

Brought 5 resource blocks up to the same documentation standard as View/Tabs/Router. Each now has `webStandards`, `events` (typed classes + provider keys), `frameworkComparison`, `designDecisions`, and `exports` in `blocks.json`, plus comprehensive njk description pages.

### Files Modified

| File | Changes |
|------|---------|
| `src/_data/blocks.json` | Expanded 5 block entries (resource-loader, resource-action, error-recovery, prefetch-behavior, action-button) |
| `src/_includes/block-descriptions/resource-loader.njk` | Added Web Standards table (6 entries), Framework Research table (5 frameworks), Infrastructure Integration section, Events section (4 typed classes), Exports table (14 items) |
| `src/_includes/block-descriptions/resource-action.njk` | Complete rewrite from 24 lines to ~250 lines. Architecture (reads vs writes), lifecycle state machine, usage examples, events, interfaces, exports |
| `src/_includes/block-descriptions/error-recovery.njk` | Major expansion from 10 lines to ~220 lines. HTTP status classification, retry strategies (immediate/linear/exponential), circuit breaker pattern, offline queuing, events (4 classes), TypeScript interfaces |
| `src/_includes/block-descriptions/prefetch-behavior.njk` | Major expansion from 10 lines to ~200 lines. Eagerness-to-events mapping, condition suppression table, router integration, events (3 classes), interfaces |
| `src/_includes/block-descriptions/action-button.njk` | Major expansion from 10 lines to ~180 lines. Busy state management, width lock, platform-aware ordering, icon integration, styling hooks, exports |

### Per-Block Summary

**Resource Loader** (upgrade):
- Added webStandards: Fetch API, AbortController, Cache API, HTTP Cache-Control (RFC 9111), aria-busy, `<progress>` element
- Added events: ResourceLoadStartEvent, ResourceLoadEndEvent, ResourceLoadErrorEvent, ResourceStateChangeEvent
- Added frameworkComparison: TanStack Query, SWR, Apollo, React Suspense, Remix

**Resource Action** (major expansion):
- Added webStandards: Fetch API, Invoker Commands (Baseline 2026), aria-disabled
- Added events: ResourceActionStartEvent, ResourceActionEndEvent, ResourceActionErrorEvent, ResourceActionRevertEvent
- Added frameworkComparison: TanStack Query, Apollo, Remix, SWR
- Added designDecisions: mutationVsQuery, doubleSubmitPrevention, optimisticRevert, virtualElement

**Error Recovery** (major expansion):
- Added webStandards: Retry-After (RFC 9110), HTTP Status Codes, navigator.onLine, Background Sync API, AbortController
- Added events: ResourceRetryEvent, ResourceRetryExhaustedEvent, ResourceOfflineQueuedEvent, ResourceCircuitOpenEvent
- Added frameworkComparison: TanStack Query, axios-retry, urql, SWR, Apollo RetryLink
- Added trait: withCircuitBreaker (3-state circuit: closed/open/half-open)

**Prefetch Behavior** (major expansion):
- Added webStandards: Speculation Rules API, IntersectionObserver, NetworkInformation, Battery Status, `<link rel="prefetch">`
- Added events: PrefetchTriggeredEvent, PrefetchSuppressedEvent, PrefetchCompleteEvent
- Added frameworkComparison: Remix, Next.js, quicklink, instant.page, Speculation Rules API
- Added designDecisions: suppressionPriority, speculationRulesAlignment

**Action Button** (moderate expansion):
- Added webStandards: Invoker Commands, aria-disabled, aria-live, CSS Containment
- Added frameworkComparison: Material UI, Radix UI, Fluent UI, Headless UI
- Added designDecisions: ariaOverDisabled, platformOrdering
- Added trait: withWidthLock

---

## 2. Plans Review

### plan.md — Router Implementation Plan
**Status: Already complete.** All 7 phases implemented. Router is `active` status with full test coverage (unit, integration, E2E) and comprehensive demo.

### plans/resource-router.md — Resource-Router Integration
**Status: Completed.** Added "Resource Pipeline Integration" section to router.njk:
- Integration map: 5-row table mapping router concerns to resource blocks
- Error Recovery integration: retry pipeline before route:error boundary
- Prefetch-to-Resource pipeline: condition checking before loader execution
- Route-scoped mutations: Resource Action within route content, cache invalidation
- Context population flow: 4-stage context building (route match → loader → error → mutation)
- Updated router `dependsOn` to include error-recovery, prefetch-behavior, resource-action

### plans/usable-title.md — Heading Hierarchy Research
**Status: Research complete.** Key findings:
- Screen readers still fundamentally rely on heading hierarchy (unchanged in 2026)
- WCAG 2.2 strongly recommends non-skipping hierarchy (SC 1.3.1, G141, H42)
- HTML5 document outline algorithm was **never implemented** by any browser and has been **removed from the spec** (WHATWG issue #83)
- Google: heading hierarchy is not a direct ranking signal; heading text content is what matters
- Best practice: one h1 per page, don't skip levels, use CSS for visual sizing
- Shadow DOM: no native heading level inheritance; use `level` prop or `role="heading" aria-level`

---

## 3. Workflow Block Spec (Plan: worfklow-blocks.md)

Created a new Workflow block — multi-step process orchestration without URL changes. The non-route complement to Router's URL-based navigation.

### Files Created/Modified

| File | Changes |
|------|---------|
| `src/_data/blocks.json` | Added `workflow` block entry with full spec |
| `src/_includes/block-descriptions/workflow.njk` | New file (~350 lines) |

### Key Design Decisions

- **Non-route workflow**: Steps are state-based, not URL-based. Router already covers URL-based multi-step flows.
- **DOM presence**: All steps remain in DOM (behavior pattern like Tabs). Inactive steps hidden + fieldset disabled.
- **Fieldset per step**: Native semantic grouping; disabled fieldset excludes from form validation.
- **Gate validation**: Per-step validation via Constraint Validation API (checkValidity/reportValidity).
- **Invoker Commands navigation**: `commandfor` + `command="--workflow-next"` / `--workflow-prev` for declarative navigation.
- **Branching**: Progressive wizard support — dynamic step lists based on user input via `workflow-branch` attribute.

### Progression Modes

- **Linear** (`withLinearProgression`): Sequential completion required. Checkout, onboarding.
- **Non-linear** (`withNonLinearProgression`): Any step accessible. Settings, surveys.
- **Branching** (`withBranchingLogic`): Dynamic steps based on input. Insurance quotes, diagnostic flows.

### Web Standards

- Constraint Validation API (Baseline) — per-step field validation
- `<fieldset>` (Standard) — semantic grouping, atomic disable
- `aria-current="step"` (Standard) — accessible step indicator
- Invoker Commands (Baseline 2026) — declarative step navigation
- CSS Scroll Snap (Baseline) — optional step transitions
- `<dialog>` (Baseline) — modal wizard focus management

### Framework Research

- Angular CDK Stepper: linear/stepControl pattern
- MUI Stepper: activeStep/nonLinear
- PatternFly Wizard: progressive wizard, review step
- Stepperize: headless orchestration
- React Hook Form: trigger() per-step validation

### Events (4 typed classes)

- `WorkflowStepBeforeChangeEvent` (cancelable) — validation gating
- `WorkflowStepChangeEvent` — step transition complete
- `WorkflowCompleteEvent` (cancelable) — final submission
- `WorkflowErrorEvent` — validation failure

---

---

## 4. Framework Adapters Analysis (Plan: framework-adapters.md)

Comprehensive comparison of React, Angular, Vue, Svelte, Lit, Solid, and Qwik features mapped against Web Everything specs. Output is a color-coded HTML report with 74 features across 14 categories.

### Files Created

| File | Description |
|------|-------------|
| `reports/2026-02-22-framework-adapters.html` | Full HTML report with color-coded tables (green=covered, blue=concept, yellow=adapter, red=missing) |

### Summary Statistics

| Coverage | Count | % |
|----------|-------|---|
| Covered (active/draft) | 40 | 54% |
| Concept (spec only) | 10 | 14% |
| Missing Adapter (syntax bridge needed) | 7 | 9% |
| Missing Feature (no equivalent) | 20 | 27% |

### Strongest Areas (at/above parity)
- **Routing**: 8/10 features covered (Navigation API, URLPattern, guards, loaders, prefetch, transitions, scroll restoration, lazy loading)
- **Component Model**: 5/6 covered (class components, lifecycle, props, refs, web component interop, traits)
- **Dependency Injection**: 3/4 covered (hierarchical DI, singletons, scoped providers)
- **Accessibility**: 3/4 covered (ARIA roles, keyboard navigation, live regions)

### Missing Adapters (7 — bridgeable with transforms)
1. **Signals** — Fine-grained reactivity over SimpleStore keys
2. **Function components** — Factory generating CustomElement subclasses
3. **Two-way binding** — `bind:attr` syntax adapter
4. **Event modifiers** — `.stop`, `.prevent`, `.once` suffixes
5. **Nested routes** — Composable `<route-view>` elements
6. **Suspense boundaries** — Resource Loader virtual element as boundary
7. **Text interpolation** — CustomTextNode parser for `{{ expression }}`

### Missing Features (20 — require new primitives)
- **SSR/Hydration** (4): SSR, Server Components, Streaming SSR, Hydration/Resumability
- **Forms** (2): Form state management, Server actions
- **i18n** (2): Localization, RTL support
- **Animations** (2): Layout animations, Spring physics
- **State** (2): Effects/watchers, Immutable updates
- **Data** (2): Request deduplication, Cache invalidation
- **Other** (6): Portals, File-based routing, CSS-in-JS, DevTools extension, Partial hydration, Resumability

### Unique to Web Everything
- Invoker Commands API integration (no other framework has this)
- Intent protocol (abstract UX contracts that decouple WHAT from HOW)
- Provider-scoped typed events (listenForScoped discrimination)
- Comment-based virtual elements (preserves CSS parent-child)

---

## 5. Transient Component Spec (Plan: transient-components.md)

New concept block for custom elements that replace themselves with semantically correct native HTML during `connectedCallback`. Enables context-aware element selection without permanent wrapper nodes.

### Files Created/Modified

| File | Changes |
|------|---------|
| `src/_data/blocks.json` | Added `transient-component` block entry with full spec |
| `src/_includes/block-descriptions/transient-component.njk` | New file (~250 lines) |

### Core Concept

A transient element calls `queueMicrotask(() => this.replaceWith(replacement))` from `connectedCallback`:
1. Custom element initializes — reads attributes, queries injector chain
2. Creates the correct native element (e.g., `<h3>` instead of `<auto-heading>`)
3. Transfers attributes and child nodes
4. Replaces itself via microtask — zero visual flash, clean lifecycle

### Key Design Decisions

- **Microtask deferral**: `queueMicrotask()` avoids `disconnectedCallback` re-entrancy
- **No customized built-ins**: Safari refuses `is=""` attribute — autonomous elements only
- **Injector-based heading level**: Mirrors React's HeadingLevelContext via InjectorRoot
- **DOM traversal fallback**: Counts `<section>`/`<article>`/`<nav>`/`<aside>` ancestors
- **SSR strategy**: Server computes correct element; client is progressive enhancement

### Use Cases

1. **AutoHeading** — `<auto-heading>` → `<h1>`–`<h6>` based on nesting depth or injector level
2. **SmartLink** — `<smart-link>` → `<a>` (has href) or `<button>` (no href)
3. **Ergonomic directives** — `<for-each>` → comment markers + repeated content
4. **Icon resolution** — `<icon name="save">` → resolved `<svg>` from registry
5. **Field groups** — `<field-group>` → `<fieldset>` + `<legend>` or `<div>`

### Research Findings (Heading Hierarchy)

- WHATWG outline algorithm **removed from spec** (May 2025) — no browser ever implemented it
- Screen readers rely on explicit `<h1>`–`<h6>` levels (unchanged in 2026)
- React's HeadingLevelContext pattern is the canonical reference
- InjectorRoot maps directly to this pattern

### Web Standards

- Element.replaceWith() (Baseline) — core replacement mechanism
- queueMicrotask() (Baseline) — safe lifecycle deferral
- Heading Elements (Standard) — native `<h1>`–`<h6>` semantics
- Custom Elements v1 (Baseline) — autonomous elements only

---

## Plans Status

All plans from `/plans` directory have been completed and removed:
- `resource-router.md` — Done (resource pipeline integration in router.njk)
- `usable-title.md` — Done (heading hierarchy research)
- `worfklow-blocks.md` — Done (workflow block spec)
- `framework-adapters.md` — Done (74-feature comparison report)
- `transient-components.md` — Done (transient component spec + njk)

The `/plans` directory is now empty.

---

## Build Verification

All changes build successfully:
```
[11ty] Copied 143 files / Wrote 139 files in 0.26 seconds
```

Page count increased from 137 to 139 (workflow + transient-component pages).
No errors, no warnings (aside from standard Node punycode deprecation).

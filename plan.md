# Router Implementation Plan

## File Structure (Hybrid: namespace with category sub-folders)

```
blocks/
  router/
    elements/
      RouteViewElement.ts      # <route-view> custom element (orchestrator + primary insertion)
      RouteOutletElement.ts    # <route-outlet> custom element (named auxiliary views only)
    behaviors/
      RouteLinkBehavior.ts     # route:link CustomAttribute on <a>
      RoutePrefetchBehavior.ts # route:prefetch CustomAttribute on <a>
    types.ts                   # All interfaces/types (shared)
    registerRouter.ts          # Registration helper
    index.ts                   # Public exports
  __tests__/
    unit/
      router/
        RouteViewElement.test.ts
        RouteOutletElement.test.ts
        RouteLinkBehavior.test.ts
        types.test.ts              # URLPattern parsing, RouteDefinition building
    integration/
      router.test.ts               # Full navigate flow: view + outlet + guards + loaders
demos/
  declarative-spa-router.html      # New demo showcasing all router features
  declarative-spa-router.css       # Styles for the router demo
```

This follows the hybrid pattern: the router namespace keeps the feature cohesive, while sub-folders (elements/, behaviors/) preserve the category-based structure from the rest of the codebase. Future multi-type blocks can follow the same pattern.

## Key Architecture Decision: In-Place Rendering

`<route-view>` renders matched content **in-place** — child `<template>` elements are inert, and matched content is stamped directly as children of `<route-view>` alongside them. This is the simplest, most intuitive model: the router renders where you define the routes.

`<route-outlet>` exists **only for named auxiliary views** — cases where a route wants to render content to a different area (header, footer, sidebar) outside the `<route-view>` element. The primary rendering path never needs a separate outlet.

```html
<!-- Primary path: content renders in-place -->
<route-view>
  <template route="/home">
    <home-page></home-page>
  </template>
  <template route="/users/:id" route:loader="loadUser">
    <user-profile></user-profile>
  </template>
  <!-- Matched content appears here as children, alongside inert templates -->
</route-view>

<!-- Named outlet: only for auxiliary views -->
<aside>
  <route-outlet name="sidebar"></route-outlet>
</aside>
```

## Implementation Phases

### Phase 1: Types + RouteViewElement (core orchestrator)

**File: `blocks/router/types.ts`**
All shared types from the design doc:
- `RouteContext`, `RouteNavigationTarget`, `RouteGuardFn`, `RouteGuardResult`
- `RouteLoaderFn`, `RouteLoaderParams`, `RouteDefinition`, `MatchedRoute`
- `NavigationResult`
- Helper: `parseRouteDefinitions(viewElement: HTMLElement): RouteDefinition[]`
  - Reads child `<template route="...">` elements
  - Parses each into a `RouteDefinition` (compiles URLPattern, reads guard/loader/error/outlet attrs)
- Helper: `matchRoute(url: URL, routes: RouteDefinition[], base?: string): MatchedRoute | null`
  - Runs URLPattern.exec() against each route definition in order
  - Returns first match with extracted params

**File: `blocks/router/elements/RouteViewElement.ts`**
Extends `HTMLElement` (or `CustomElement` from plugs/webcomponents).
- `static observedAttributes = ['scroll', 'base', 'transition', 'keep-alive']`
- `connectedCallback()`:
  1. Parse child templates via `parseRouteDefinitions(this)`
  2. Find named `<route-outlet>` elements in the document (for auxiliary views only)
  3. Add `navigation.addEventListener('navigate', this.#onNavigate)` (or History fallback)
  4. Perform initial route match for current URL
- `disconnectedCallback()`: remove listener, cleanup
- `attributeChangedCallback()`: update config (scroll mode, base, etc.)
- `#onNavigate(event: NavigateEvent)`: the navigation pipeline
  1. Check `event.canIntercept`
  2. Match route via `matchRoute()`
  3. Run canDeactivate guard (resolve from `customContexts:routeGuard` via `InjectorRoot.getProviderOf`)
  4. `event.intercept({ handler })` with:
     - canActivate guard
     - Loader execution (with `event.signal`)
     - Template stamping **into `this`** (in-place rendering)
     - If route has `route:outlet="name"`, stamp into the named `<route-outlet>` instead
     - Set `customContexts:route` on the element's injector (self or outlet)
- `navigate(path, options)`: wraps `navigation.navigate()`
- `back()` / `forward()`: wraps `navigation.back()` / `navigation.forward()`
- `routes` / `currentRoute` readonly getters
- `#resolveGuard(routeDef, type)`: looks up guard name from `@routeGuard` context
- `#resolveLoader(routeDef)`: looks up loader name from `@routeLoader` context
- `#stampRoute(matched, data, error)`: clone template, set context, append to self (or named outlet)
- `#unstampRoute(keepAlive)`: remove or hide current content
- `#findOutlet(name)`: find `<route-outlet name="...">` for named auxiliary views

**Unit tests for Phase 1:**
- `types.test.ts`: `parseRouteDefinitions` with various template configs, `matchRoute` with params/wildcards/optionals
- `RouteViewElement.test.ts`: element creation, attribute observation, child template parsing, route matching, guard resolution from injector, loader resolution, in-place template stamping, error boundary selection

### Phase 2: RouteOutletElement (named auxiliary views only)

**File: `blocks/router/elements/RouteOutletElement.ts`**
Extends `HTMLElement` (or `CustomElement`).
- `static observedAttributes = ['name']`
- `name` getter: returns attribute value (required — unnamed outlets are not needed, `<route-view>` is the primary)
- `activeContent` / `activeRoute` readonly getters
- `connectedCallback()`: registers itself (dispatches event or sets on injector so `<route-view>` can find it)
- `disconnectedCallback()`: cleanup
- Stamping methods called by `RouteViewElement`:
  - `stamp(content: DocumentFragment, route: MatchedRoute)`: append content, update state
  - `unstamp(keepAlive: boolean)`: remove or hide content
- Events: dispatches `beforetoggle`/`toggle` on content changes (matching ViewEngine pattern)
- CSS: `display: block` by default (via constructor or adopted stylesheet)

**Unit tests:**
- Element creation, name attribute, stamp/unstamp, event dispatching, aria-busy during loading

### Phase 3: RouteLinkBehavior + RoutePrefetchBehavior

**File: `blocks/router/behaviors/RouteLinkBehavior.ts`**
Extends `CustomAttribute`.
- `connectedCallback()`:
  1. Set `href` on the `<a>` target from `this.value`
  2. Add click handler that calls `navigation.navigate(this.value)` + `event.preventDefault()`
  3. Listen to `navigation.addEventListener('currententrychange', ...)` for active state
  4. Set/remove `.active` class based on current URL match
- `disconnectedCallback()`: remove listeners
- `isActive` getter

**File: `blocks/router/behaviors/RoutePrefetchBehavior.ts`**
Extends `CustomAttribute`.
- `connectedCallback()`:
  - `'hover'`: add mouseenter/focus listener → prefetch
  - `'visible'`: create IntersectionObserver → prefetch when visible
  - `'eager'`: prefetch immediately
  - `'none'`: do nothing
- `disconnectedCallback()`: cleanup observers/listeners
- Prefetch: find parent `<route-view>`, resolve loader for the target path, call it (result cached)

**Unit tests:**
- Link click interception, active class management, prefetch trigger modes

### Phase 4: Registration + Bootstrap Integration

**File: `blocks/router/registerRouter.ts`**
```typescript
export function registerRouter(attributes: CustomAttributeRegistry): void {
  customElements.define('route-view', RouteViewElement);
  customElements.define('route-outlet', RouteOutletElement);
  attributes.define('route:link', RouteLinkBehavior);
  attributes.define('route:prefetch', RoutePrefetchBehavior);
}
```

**File: `blocks/router/index.ts`**
Re-exports all public API: elements, behaviors, types, registerRouter.

**Update `plugs/bootstrap.ts`**:
- Import `registerRouter` from blocks/router
- Call `registerRouter(window.attributes)` after attribute setup

### Phase 5: Integration Tests

**File: `blocks/__tests__/integration/router.test.ts`**
Full navigation flow with happy-dom:
1. Setup: InjectorRoot, CustomAttributeRegistry, register router
2. Create `<route-view>` with child templates, navigation links
3. Test: navigate programmatically → guard runs → loader runs → content stamped in `<route-view>` → `@route` context available
4. Test: canDeactivate guard blocks navigation
5. Test: canActivate guard redirects
6. Test: loader error → error boundary template stamped
7. Test: navigation supersede → signal aborted
8. Test: named outlet (`route:outlet="sidebar"` → content in `<route-outlet name="sidebar">`)
9. Test: active link class updates

**Note:** happy-dom may not have full Navigation API support. We'll need to check and potentially mock `window.navigation`. The implementation should have a fallback path that uses History API (`popstate` + `pushState`), which happy-dom does support. This fallback is needed for Safari <17.2 anyway per the design doc.

### Phase 6: Demo

**File: `demos/declarative-spa-router.html`**
A complete demo that exercises every feature:

- **Route-based navigation** replacing the current `data-view` button-based approach
- **3+ routes**: `/counter`, `/todos`, `/users/:id`
- **Guards**: `/admin` route with a `requireAuth` guard that redirects to `/login`
- **Loaders**: `/users/:id` route with a simulated `loadUser` loader (setTimeout fetch mock)
- **Error boundary**: `/users/999` shows error UI
- **Named outlet**: sidebar outlet with dashboard nav on certain routes
- **Active links**: nav links with `.active` class
- **Prefetching**: hover prefetch on some links
- Uses the same source viewer pattern as existing `declarative-spa.html`
- Both `<script type="text/plain">` (viewer) and `<script type="module">` (running code)
- Signals `window.demoReady = true` when complete

**File: `demos/declarative-spa-router.css`** (or reuse existing CSS with additions)

### Phase 7: Navigation API Fallback

The Navigation API is Baseline 2024 but happy-dom doesn't support it. The implementation needs:
- Feature detect: `'navigation' in window`
- If available: use `navigation.addEventListener('navigate', ...)` as designed
- If unavailable: fallback to `window.addEventListener('popstate', ...)` + `history.pushState()`
- The guard/loader/stamp pipeline stays the same — only the event source differs
- This is also needed for Safari <17.2 per the design doc

This will be built into `RouteViewElement` from the start as a private `#NavigationAdapter` abstraction (or just an if/else in `connectedCallback`).

## Implementation Order

1. **types.ts** — all types + `parseRouteDefinitions` + `matchRoute` helpers
2. **RouteViewElement.ts** — core orchestrator with in-place rendering, Navigation API + History fallback
3. **RouteOutletElement.ts** — named outlet component (auxiliary views only)
4. **Unit tests** for types, view element, outlet element
5. **RouteLinkBehavior.ts** — link behavior
6. **RoutePrefetchBehavior.ts** — prefetch behavior
7. **Unit tests** for link + prefetch
8. **registerRouter.ts** + **index.ts** — registration and exports
9. **Update bootstrap.ts** — integrate into plugged mode
10. **Integration tests** — full navigation flow
11. **Demo HTML + CSS** — showcase all features
12. **Update blocks.json** — mark status as `active` once tests pass

## Key Design Decisions During Implementation

- **In-place rendering**: `<route-view>` stamps matched content as its own children. Child `<template>` elements remain inert alongside the stamped content. This is the simplest model — the router renders where you define the routes.
- **Named outlets only**: `<route-outlet>` is only for named auxiliary views (sidebar, header, footer). The primary rendering path uses `<route-view>` directly.
- **URLPattern**: Use the native `URLPattern` constructor. happy-dom may not support it — we'll use the `urlpattern-polyfill` package for tests if needed, or mock it.
- **ViewEngine integration**: Start without ViewEngine (simple DOM append/remove). Add ViewEngine for keep-alive and transitions as a follow-up if ViewEngine is already implemented.
- **Injector access**: Use `InjectorRoot.getProviderOf(this, 'customContexts:routeGuard')` to resolve guards/loaders. The `<route-view>` element must be in the DOM and within an injector tree.
- **Template stamping**: `template.content.cloneNode(true)` → set context on `<route-view>`'s injector (or named outlet's injector) → `this.appendChild(fragment)`. On unstamp: remove stamped content (templates remain).

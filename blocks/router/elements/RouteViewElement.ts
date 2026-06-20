/**
 * @file blocks/router/elements/RouteViewElement.ts
 * @description Main router orchestrator. Owns child <template route="...">
 * definitions, listens to Navigation API events, runs guards and loaders,
 * and stamps matched content in-place as its own children.
 *
 * For named auxiliary views, stamps into <route-outlet> elements instead.
 *
 * Default tag name: route-view
 */

import InjectorRoot from '@frontierui/plugs/webinjectors/InjectorRoot';
import type {
  RouteDefinition,
  MatchedRoute,
  NavigationResult,
  RouteGuardFn,
  RouteGuardResult,
  RouteLoaderFn,
  RouteNavigationTarget,
} from '../types';
import {
  parseRouteDefinitions,
  matchRoute,
  matchAllRoutes,
  findErrorBoundary,
  buildNavigationTarget,
  buildRouteContext,
  normalizePath,
} from '../types';
import type RouteOutletElement from './RouteOutletElement';

export default class RouteViewElement extends HTMLElement {
  static observedAttributes = ['scroll', 'base', 'transition', 'keep-alive', 'entry'];

  #routes: RouteDefinition[] = [];
  #currentRoute: MatchedRoute | null = null;
  #currentTarget: RouteNavigationTarget | null = null;
  #stampedContent: Node[] = [];
  #initialized = false;

  // Navigation API listener reference for cleanup
  #navHandler: ((event: any) => void) | null = null;
  // History API listener references for cleanup
  #popstateHandler: ((event: PopStateEvent) => void) | null = null;
  #currentAbortController: AbortController | null = null;

  /** All parsed route definitions from child <template> elements */
  get routes(): ReadonlyArray<RouteDefinition> {
    return this.#routes;
  }

  /** Currently matched and active route (null before first navigation) */
  get currentRoute(): MatchedRoute | null {
    return this.#currentRoute;
  }

  /** Scroll restoration mode ('manual' | 'after-transition' | null) */
  get scroll(): string | null {
    return this.getAttribute('scroll');
  }

  /** Base path prepended to all route patterns */
  get base(): string {
    return this.getAttribute('base') || '';
  }

  /**
   * Default in-route-space path to land on when the load-time (entry) URL resolves to no route — e.g.
   * the app is served at `/demos/<id>/index.html` or a mounted base path. Built-in entry normalization
   * (#365): set `entry="/book"` instead of hand-rolling a `history.replaceState` shim before connect.
   */
  get entry(): string {
    return this.getAttribute('entry') || '';
  }

  /** Whether View Transitions are enabled */
  get transition(): boolean {
    return this.hasAttribute('transition');
  }

  /** Whether deactivated routes are cached instead of destroyed */
  get keepAlive(): boolean {
    return this.hasAttribute('keep-alive');
  }

  connectedCallback(): void {
    // Parse child templates
    this.#routes = parseRouteDefinitions(this, this.base);

    // Set up navigation listener
    if (this.#hasNavigationAPI()) {
      this.#listenNavigationAPI();
    } else {
      this.#listenHistoryAPI();
    }

    // Initial route match — normalize the entry URL into the route space first (#365).
    if (!this.#initialized) {
      this.#initialized = true;
      const url = this.#normalizeEntryUrl();
      this.#currentAbortController = new AbortController();
      this.#handleNavigation(url, 'push', this.#currentAbortController.signal);
    }
  }

  /**
   * Map the load-time (entry) URL into the route space so consumers stop hand-rolling a
   * `history.replaceState` shim before `route-view` connects (#365). Native-first (History API):
   *   1. Strip a trailing `index.html` — a hard reload of a file-served SPA entry.
   *   2. If the (stripped) URL already resolves to a route, keep it (only `replaceState` if step 1
   *      rewrote the path) — an explicit deep link wins over the entry default.
   *   3. Otherwise, if `entry` is set, `replaceState` to the entry route mapped through `base`, so the
   *      initial match lands on the app's default view instead of a blank no-match.
   * Returns the URL the initial match should use. No-op (returns the live URL) when neither applies.
   *
   * Note: a hard reload of a deep link (e.g. `/application`) on a static dev server can still 404 before
   * the SPA boots — that needs a dev-server SPA history fallback (serve index.html for unknown paths),
   * which is a server config, not something the block can do from inside the page.
   */
  #normalizeEntryUrl(): URL {
    const url = new URL(window.location.href);
    const original = url.href;

    if (url.pathname.endsWith('/index.html')) {
      url.pathname = url.pathname.slice(0, -'index.html'.length);
    }

    if (matchRoute(url, this.#routes)) {
      if (url.href !== original) history.replaceState(history.state, '', url.href);
      return url;
    }

    if (this.entry) {
      const rel = this.entry.startsWith('/') ? this.entry : `/${this.entry}`;
      url.pathname = normalizePath(this.base + rel);
      history.replaceState(history.state, '', url.href);
    }
    return url;
  }

  disconnectedCallback(): void {
    if (this.#navHandler) {
      (window as any).navigation?.removeEventListener('navigate', this.#navHandler);
      this.#navHandler = null;
    }
    if (this.#popstateHandler) {
      window.removeEventListener('popstate', this.#popstateHandler);
      this.#popstateHandler = null;
    }
    this.#currentAbortController?.abort();
  }

  attributeChangedCallback(
    name: string,
    _oldValue: string | null,
    _newValue: string | null,
  ): void {
    if (name === 'base') {
      this.#routes = parseRouteDefinitions(this, this.base);
    }
  }

  /**
   * Navigate programmatically.
   */
  navigate(
    path: string,
    options?: { replace?: boolean; state?: unknown },
  ): NavigationResult {
    if (this.#hasNavigationAPI()) {
      return this.#navigateViaNavigationAPI(path, options);
    }
    return this.#navigateViaHistoryAPI(path, options);
  }

  /** Navigate back. */
  back(): void {
    if (this.#hasNavigationAPI()) {
      (window as any).navigation.back();
    } else {
      history.back();
    }
  }

  /** Navigate forward. */
  forward(): void {
    if (this.#hasNavigationAPI()) {
      (window as any).navigation.forward();
    } else {
      history.forward();
    }
  }

  // -----------------------------------------------------------------------
  // Feature detection
  // -----------------------------------------------------------------------

  #hasNavigationAPI(): boolean {
    return 'navigation' in window;
  }

  // -----------------------------------------------------------------------
  // Navigation API path
  // -----------------------------------------------------------------------

  #listenNavigationAPI(): void {
    this.#navHandler = (event: any) => {
      if (!event.canIntercept || event.hashChange) return;

      const url = new URL(event.destination.url);
      const navType: string = event.navigationType || 'push';

      // Match route
      const matched = matchRoute(url, this.#routes);
      if (!matched) return;

      const toTarget = buildNavigationTarget(matched, navType as any);

      // canDeactivate — runs BEFORE intercept (URL hasn't committed)
      const leaveResult = this.#runGuardSync(
        this.#currentRoute?.definition,
        'leave',
        toTarget,
        this.#currentTarget,
      );

      if (leaveResult === false) {
        event.preventDefault();
        return;
      }
      if (typeof leaveResult === 'string') {
        event.preventDefault();
        this.navigate(leaveResult);
        return;
      }

      // Intercept — URL commits
      // NavigationScrollBehavior only accepts 'after-transition' or 'manual'
      const scrollAttr = this.getAttribute('scroll');
      const interceptOpts: any = {
        handler: async () => {
          await this.#runNavigationPipeline(
            matched,
            toTarget,
            event.signal,
            event.destination?.getState?.(),
          );
        },
      };
      if (scrollAttr === 'manual' || scrollAttr === 'after-transition') {
        interceptOpts.scroll = scrollAttr;
      }
      event.intercept(interceptOpts);
    };

    (window as any).navigation.addEventListener('navigate', this.#navHandler);
  }

  #navigateViaNavigationAPI(
    path: string,
    options?: { replace?: boolean; state?: unknown },
  ): NavigationResult {
    const nav = (window as any).navigation;
    const result = nav.navigate(path, {
      history: options?.replace ? 'replace' : 'push',
      state: options?.state,
    });
    return {
      committed: result.committed.then(() => {}),
      finished: result.finished.then(() => {}),
    };
  }

  // -----------------------------------------------------------------------
  // History API fallback path
  // -----------------------------------------------------------------------

  #listenHistoryAPI(): void {
    this.#popstateHandler = () => {
      this.#currentAbortController?.abort();
      this.#currentAbortController = new AbortController();
      const url = new URL(window.location.href);
      this.#handleNavigation(url, 'traverse', this.#currentAbortController.signal);
    };
    window.addEventListener('popstate', this.#popstateHandler);
  }

  #navigateViaHistoryAPI(
    path: string,
    options?: { replace?: boolean; state?: unknown },
  ): NavigationResult {
    this.#currentAbortController?.abort();
    this.#currentAbortController = new AbortController();

    const url = new URL(path, window.location.origin);
    if (options?.replace) {
      history.replaceState(options?.state ?? null, '', url.href);
    } else {
      history.pushState(options?.state ?? null, '', url.href);
    }

    let resolveCommitted!: () => void;
    let resolveFinished!: () => void;
    const committed = new Promise<void>((r) => { resolveCommitted = r; });
    const finished = new Promise<void>((r) => { resolveFinished = r; });

    resolveCommitted();
    this.#handleNavigation(url, 'push', this.#currentAbortController.signal, options?.state)
      .then(resolveFinished);

    return { committed, finished };
  }

  // -----------------------------------------------------------------------
  // Core navigation pipeline (used by History fallback + initial load)
  // -----------------------------------------------------------------------

  async #handleNavigation(
    url: URL,
    navType: string,
    signal: AbortSignal,
    state?: unknown,
  ): Promise<void> {
    const matched = matchRoute(url, this.#routes);
    if (!matched) return;

    const toTarget = buildNavigationTarget(matched, navType as any);

    // canDeactivate
    const leaveResult = await this.#runGuard(
      this.#currentRoute?.definition,
      'leave',
      toTarget,
      this.#currentTarget,
    );

    if (signal.aborted) return;
    if (leaveResult === false) return;
    if (typeof leaveResult === 'string') {
      this.navigate(leaveResult);
      return;
    }

    await this.#runNavigationPipeline(matched, toTarget, signal, state);
  }

  // -----------------------------------------------------------------------
  // Shared pipeline
  // -----------------------------------------------------------------------

  async #runNavigationPipeline(
    matched: MatchedRoute,
    toTarget: RouteNavigationTarget,
    signal: AbortSignal,
    state?: unknown,
  ): Promise<void> {
    // canActivate
    const enterResult = await this.#runGuard(
      matched.definition,
      'enter',
      toTarget,
      this.#currentTarget,
    );

    if (signal.aborted) return;
    if (enterResult === false) {
      if (this.#currentRoute) {
        this.navigate(this.#currentRoute.url.pathname, { replace: true });
      }
      return;
    }
    if (typeof enterResult === 'string') {
      this.navigate(enterResult, { replace: true });
      return;
    }

    // Loader
    let data: unknown;
    let error: Error | null = null;

    const loader = this.#resolveLoader(matched.definition);
    if (loader) {
      this.setAttribute('aria-busy', 'true');
      this.dispatchEvent(new CustomEvent('route-load-start', {
        detail: { route: matched },
        bubbles: true,
      }));

      try {
        data = await loader({
          params: matched.params,
          query: new URLSearchParams(matched.url.search),
          signal,
        });
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
      }

      this.removeAttribute('aria-busy');

      if (signal.aborted) return;
    }

    // Update state
    const previousTarget = this.#currentTarget;
    this.#currentTarget = toTarget;
    this.#currentRoute = matched;

    // Stamp BEFORE dispatching events — so stamped content
    // exists when event handlers run (e.g., to populate loader data)
    const allMatches = matchAllRoutes(matched.url, this.#routes);
    this.#stampAllRoutes(allMatches, matched, data, error, state);

    // Dispatch events AFTER stamping
    this.dispatchEvent(new CustomEvent('route-change', {
      detail: { from: previousTarget, to: toTarget, matched },
      bubbles: true,
    }));

    if (error) {
      this.dispatchEvent(new CustomEvent('route-error', {
        detail: { route: matched, error },
        bubbles: true,
      }));
    } else if (loader) {
      this.dispatchEvent(new CustomEvent('route-load-end', {
        detail: { route: matched, data },
        bubbles: true,
      }));
    }
  }

  // -----------------------------------------------------------------------
  // Guard resolution
  // -----------------------------------------------------------------------

  #runGuardSync(
    routeDef: RouteDefinition | undefined,
    type: 'enter' | 'leave',
    to: RouteNavigationTarget,
    from: RouteNavigationTarget | null,
  ): RouteGuardResult {
    const guardFn = this.#resolveGuardFn(routeDef, type);
    if (!guardFn) return true;

    const result = guardFn(to, from);
    if (result instanceof Promise) return true;
    return result;
  }

  async #runGuard(
    routeDef: RouteDefinition | undefined,
    type: 'enter' | 'leave',
    to: RouteNavigationTarget,
    from: RouteNavigationTarget | null,
  ): Promise<RouteGuardResult> {
    const guardFn = this.#resolveGuardFn(routeDef, type);
    if (!guardFn) return true;
    return guardFn(to, from);
  }

  #resolveGuardFn(
    routeDef: RouteDefinition | undefined,
    type: 'enter' | 'leave',
  ): RouteGuardFn | undefined {
    if (!routeDef) return undefined;

    const guardName = type === 'enter' ? routeDef.guard : routeDef.guardLeave;
    if (!guardName) return undefined;

    const guards = InjectorRoot.getProviderOf(
      this,
      'customContexts:routeGuard' as any,
    ) as Record<string, RouteGuardFn> | undefined;

    return guards?.[guardName];
  }

  // -----------------------------------------------------------------------
  // Loader resolution
  // -----------------------------------------------------------------------

  #resolveLoader(routeDef: RouteDefinition): RouteLoaderFn | undefined {
    if (!routeDef.loader) return undefined;

    const loaders = InjectorRoot.getProviderOf(
      this,
      'customContexts:routeLoader' as any,
    ) as Record<string, RouteLoaderFn> | undefined;

    return loaders?.[routeDef.loader];
  }

  // -----------------------------------------------------------------------
  // Template stamping
  // -----------------------------------------------------------------------

  /**
   * Stamp all matching routes: primary into self, outlet-targeted into outlets.
   */
  #stampAllRoutes(
    allMatches: MatchedRoute[],
    primaryMatch: MatchedRoute,
    data: unknown,
    error: Error | null,
    state?: unknown,
  ): void {
    const context = buildRouteContext(primaryMatch, data, error, state);

    // Unstamp everything first
    this.#unstampFrom(this);
    // Also unstamp from any previously used outlets
    for (const outletEl of document.querySelectorAll('route-outlet')) {
      this.#unstampFrom(outletEl as HTMLElement);
    }

    for (const match of allMatches) {
      let templateDef = match.definition;

      // If error, swap for error boundary (only for primary)
      if (error && !templateDef.outlet) {
        const errorBoundary = findErrorBoundary(
          templateDef.path,
          this.#routes,
        );
        if (errorBoundary) {
          templateDef = errorBoundary;
        }
      }

      // Determine stamp target
      const outletName = templateDef.outlet;
      const stampTarget: HTMLElement = outletName
        ? this.#findOutlet(outletName) ?? this
        : this;

      // Clone template
      const fragment = templateDef.template.content.cloneNode(true) as DocumentFragment;

      // Set context on the stamp target's injector
      const injRoot = InjectorRoot.getInjectorRootOf(stampTarget);
      if (injRoot) {
        const injector = injRoot.ensureInjector(stampTarget);
        injector.set('customContexts:route', context);
      }

      // Track stamped nodes
      const nodes = Array.from(fragment.childNodes);

      // #423 — contract boundary: a route whose <template> body is non-empty must stamp at least
      // one live node. A content-specific stamping defect (surfaced by the auto-insurance quote
      // wizard: a complex multi-fieldset inline form) can clone to an empty fragment, leaving the
      // view blank with NO console error — a silent no-op that reads as "the route is broken".
      // Convert that into a diagnosable error naming the route, rather than failing silently.
      // (Workaround for an affected route: author its body as an empty mount + imperative fill.)
      if (templateDef.template.content.childNodes.length > 0 && nodes.length === 0) {
        console.error(
          `[Router] route "${templateDef.path}" matched a non-empty <template> but cloned to an ` +
            `empty fragment — nothing was stamped and the view will be blank (#423). A complex ` +
            `inline form fragment can trigger this; author the route body as an empty mount and ` +
            `fill it imperatively, or simplify the inline markup.`,
        );
      }

      // Append. A throw here (an invalid node in the cloned body) would otherwise propagate out of
      // an async navigation handler as an unhandled rejection with no route context — surface it
      // instead as a clear, route-identified error so the failure is never silent (#423).
      try {
        stampTarget.appendChild(fragment);
      } catch (err) {
        console.error(
          `[Router] failed to stamp route "${templateDef.path}" — appending the cloned template ` +
            `body threw: ${err instanceof Error ? err.message : String(err)} (#423).`,
        );
        continue;
      }

      // Accumulate (don't overwrite): a single navigation may stamp more than
      // one fragment into the same target (e.g. an outlet match that falls back
      // to `this` when its outlet is absent). Overwriting here would orphan the
      // earlier nodes so the next #unstampFrom couldn't remove them — leaking
      // content that piles up across navigations.
      if (stampTarget === this) {
        this.#stampedContent.push(...nodes);
      } else {
        ((stampTarget as any).__routeStampedContent ??= []).push(...nodes);
      }
    }
  }

  #unstampFrom(target: HTMLElement): void {
    const nodes: Node[] = target === this
      ? this.#stampedContent
      : (target as any).__routeStampedContent || [];

    for (const node of nodes) {
      if (node.parentNode === target) {
        target.removeChild(node);
      }
    }

    if (target === this) {
      this.#stampedContent = [];
    } else {
      (target as any).__routeStampedContent = [];
    }
  }

  // -----------------------------------------------------------------------
  // Outlet discovery
  // -----------------------------------------------------------------------

  #findOutlet(name: string): RouteOutletElement | null {
    return document.querySelector(
      `route-outlet[name="${name}"]`,
    ) as RouteOutletElement | null;
  }
}

/**
 * Declarative `<script type="injector">` domain/Protocol binding (#278) — the runtime, no-build,
 * no-resolver form of the injector DSL, pulled forward from #002's ruling (`@domain` **is** a
 * [Protocol](/protocols/); the `@scope/name` string is the Protocol's identity).
 *
 * A `<script type="injector">` block declares, declaratively in markup, that a DOM subtree is bound to
 * a domain (a Protocol) and the impl provided for it — without a build step or a runtime module
 * resolver (impl binding rides the module-resolution axis #264/#271/#274, not this code). The block's
 * content is JSON `{ "domain": "@scope/name", "provide": <impl> }`:
 *
 *   <section>
 *     <script type="injector" id="dateProvider">
 *       { "domain": "@date/core", "provide": { "addMonths": "…" } }
 *     </script>
 *     <date-widget injector="dateProvider">…</date-widget>   <!-- explicit association -->
 *     <p>…descendants inherit @date/core implicitly…</p>
 *   </section>
 *
 * Two association forms (from the gap analysis):
 *  - **Implicit subtree inheritance** — the binding is installed on the script's *parent element*, so
 *    every descendant of that parent resolves the domain via the normal injector chain, and nothing
 *    *outside* the subtree sees it (isolation to the block parent).
 *  - **Explicit `injector="id"`** — an element carrying `injector="<script id>"` binds to that named
 *    injector regardless of DOM position, for cross-cutting association.
 *
 * This module is the parse + install + resolve mechanism; it reuses the real {@link InjectorRoot}
 * (`ensureInjector` + `injector.set`) so a declared provider resolves through the same chain as an
 * imperatively-provided one. Excludes the build-time `provide`/`consume` DSL (deferred — #279).
 */

import type InjectorRoot from './InjectorRoot';
import type HTMLInjector from './HTMLInjector';

/** The `type` attribute value that marks an injector script. */
export const INJECTOR_SCRIPT_TYPE = 'injector';

/** The attribute by which an element explicitly binds to a named injector script (`injector="id"`). */
export const INJECTOR_ASSOC_ATTR = 'injector';

/** Already-installed scripts, so a re-scan (e.g. after DOM mutation) does not double-install. */
const processed = new WeakSet<Element>();

/** A parsed `<script type="injector">` binding: the domain (Protocol identity) and the provided impl. */
export interface InjectorScriptBinding {
  /** The script's `id` (the key for `injector="id"` association), or `null` if unidentified. */
  id: string | null;
  /** The `@domain` — a Protocol identity string (#002). Used as the injector provider key. */
  domain: string;
  /** The impl bound for the domain within this subtree. */
  provide: unknown;
  /** The subtree root this binding isolates to (the script's parent element). */
  scope: Element;
  /** The injector the binding was installed on (the scope's injector). */
  injector: HTMLInjector;
}

/** Result of {@link applyDeclarativeInjectors}: every installed binding + the id→injector index. */
export interface DeclarativeInjectorResult {
  bindings: InjectorScriptBinding[];
  /** `injector="id"` lookup: script id → the injector it installed. */
  byId: Map<string, HTMLInjector>;
}

/** A `<script type="injector">` whose body is not the expected `{ domain, provide }` shape. */
export class InjectorScriptError extends Error {
  constructor(why: string) {
    super(`<script type="injector"> binding invalid: ${why}`);
    this.name = 'InjectorScriptError';
  }
}

/**
 * Parse one `<script type="injector">` element's JSON body into its `{ domain, provide }` binding.
 * Throws {@link InjectorScriptError} on malformed JSON, a missing/empty `domain`, or an absent
 * `provide`. (A `provide` of `null`/`false`/`0` is honoured — only *absence* is an error.)
 */
export function parseInjectorScript(script: HTMLScriptElement): { domain: string; provide: unknown } {
  const raw = (script.textContent ?? '').trim();
  if (!raw) throw new InjectorScriptError('empty script body');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new InjectorScriptError(`body is not valid JSON (${(e as Error).message})`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new InjectorScriptError('body must be a JSON object');

  const obj = parsed as Record<string, unknown>;
  if (typeof obj.domain !== 'string' || obj.domain.trim() === '')
    throw new InjectorScriptError('missing a non-empty "domain" (the Protocol identity)');
  if (!('provide' in obj))
    throw new InjectorScriptError('missing "provide" (the impl bound for the domain)');

  return { domain: obj.domain, provide: obj.provide };
}

/**
 * Find and install every `<script type="injector">` under `root`, binding each declared domain to the
 * script's parent-element subtree via `injectorRoot`. Idempotent: a script already installed is
 * skipped, so this is safe to call again after DOM changes. Returns the installed bindings and the
 * `injector="id"` index. A malformed or parentless script is skipped with a `console.warn` (never
 * throws for one bad block — the rest still install).
 */
export function applyDeclarativeInjectors(
  injectorRoot: InjectorRoot,
  root: ParentNode = document,
): DeclarativeInjectorResult {
  const scripts = root.querySelectorAll<HTMLScriptElement>(
    `script[type="${INJECTOR_SCRIPT_TYPE}"]`,
  );
  const bindings: InjectorScriptBinding[] = [];
  const byId = new Map<string, HTMLInjector>();

  for (const script of Array.from(scripts)) {
    if (processed.has(script)) continue;

    const scope = script.parentElement;
    if (!scope) {
      // eslint-disable-next-line no-console
      console.warn('[declarative-injector] <script type="injector"> has no parent element to scope to; skipped.');
      continue;
    }

    let domain: string;
    let provide: unknown;
    try {
      ({ domain, provide } = parseInjectorScript(script));
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[declarative-injector] ${(e as Error).message} — skipped.`);
      continue;
    }

    const injector = injectorRoot.ensureInjector(scope);
    injector.set(domain as never, provide as never);
    processed.add(script);

    const id = script.id || null;
    if (id) byId.set(id, injector);
    bindings.push({ id, domain, provide, scope, injector });
  }

  return { bindings, byId };
}

/**
 * Resolve the impl an `element` sees for `domain`, honouring both association forms:
 *  1. **Explicit** — if the element carries `injector="<id>"` and that id was installed, the named
 *     injector's provider wins (cross-cutting association, ignores DOM position).
 *  2. **Implicit** — otherwise walk up the element's ancestor chain and return the nearest installed
 *     injector that provides `domain` (subtree inheritance, isolated to the block parent).
 *
 * Returns `undefined` when no in-scope binding provides the domain. Pure resolution against the
 * `result` of {@link applyDeclarativeInjectors} + the live `injectorRoot` — no module resolution.
 */
export function resolveDeclaredProvider(
  injectorRoot: InjectorRoot,
  result: DeclarativeInjectorResult,
  element: Element,
  domain: string,
): unknown {
  const assoc = element.getAttribute(INJECTOR_ASSOC_ATTR);
  if (assoc) {
    const named = result.byId.get(assoc);
    if (named) {
      const provided = named.get(domain as never);
      if (provided !== undefined) return provided;
    }
  }

  let current: Element | null = element;
  while (current) {
    const injector = injectorRoot.getInjectorOf(current as never);
    const provided = injector?.get(domain as never);
    if (provided !== undefined) return provided;
    current = current.parentElement;
  }
  return undefined;
}

/**
 * Declarative `<script type="registry">` scoped-registration binding (#901, implements the #854 ruling).
 *
 * The runtime, no-build, Tier-1.5 form of scoped custom-element registration — the structural twin of the
 * shipped `<script type="injector">` DSL (#278, see `../webinjectors/declarativeInjector.ts`). #854 ruled
 * that scoped registration lives **OFF** `<component>` (a `<component>` is a build-time transform, gone by
 * runtime, so it can't host a runtime registry object) as three composable pieces, all built here:
 *
 *  1. **A declared-registry form** — a `<script type="registry">` block declares a scoped
 *     {@link CustomElementRegistry} in markup, with `extends` composing other declared registries by
 *     **local IDREF** (mirroring the registry runtime's object-keyed `extends`, #228), and `define`
 *     mapping a tag to a constructor reference. Definitions register into the registry **object** the
 *     moment the script is scanned — *dom-less declaration registration* (a registry is a JS object, not
 *     DOM-bound), with a **lazy queue** for any reference whose module hasn't loaded yet (MOMENT 2).
 *  2. **A consumer-side association attribute** — `registry="<id>"` (#900), a *local DOM IDREF* (exactly
 *     like `injector="id"`; resolved via a `byId` index, never a global namespace). A `{{ expr }}` value
 *     is the bridge for a raw foreign registry **object** not declared in markup (the #854 E form).
 *  3. **A CustomAttribute binding behavior** — {@link ScopedRegistryAttribute}, the `registry` attribute's
 *     behavior, which at attach time (MOMENT 2) resolves the association to a registry object and maps it
 *     through to the consumer's shadow root (the native `attachShadow({ customElementRegistry })` /
 *     `shadowrootcustomelementregistry` consumption path).
 *
 * The keyword `provide`/`consume`-style build DSL stays Tier-3 (#279) — not built here. This module is the
 * parse + compose + scoped-define + associate + map-through mechanism; it reuses the real scoped
 * {@link CustomElementRegistry} (#228-safe construction) so a declared definition resolves through the same
 * machine as an imperatively-defined one.
 *
 *   <section>
 *     <script type="registry" id="cardScope">
 *       { "extends": ["baseScope"], "define": { "my-card": "MyCard" } }
 *     </script>
 *     <my-card registry="cardScope">…</my-card>   <!-- explicit association (#900) -->
 *   </section>
 */

import CustomElementRegistry, { type ImplementedElement } from './CustomElementRegistry';

/** The `type` attribute value that marks a declared-registry script. */
export const REGISTRY_SCRIPT_TYPE = 'registry';

/**
 * The attribute by which a consumer element binds to a named declared registry (`registry="id"`, #900).
 * Equals the `<script type="registry">` token, exactly as `injector="id"` equals `<script type="injector">`.
 */
export const REGISTRY_ASSOC_ATTR = 'registry';

/** Already-installed scripts, so a re-scan (e.g. after DOM mutation) does not double-install. */
const processed = new WeakSet<Element>();

/**
 * Resolves a constructor *reference* (the string a `define` entry carries) to a real element class. In
 * production this is the `{{ expr }}` bridge (webexpressions) — the same raw-object escape hatch the #854
 * E form uses; in tests it is a plain map. Returning `undefined` means "not available yet" → the entry is
 * lazily queued, not an error (dom-less / not-yet-imported modules are expected).
 */
export type CtorResolver = (ref: string) => ImplementedElement | undefined;

/** Options for {@link applyDeclarativeRegistries}. */
export interface DeclarativeRegistryOptions {
  /** Resolve a `define` reference string to a constructor. Absent ⇒ every definition is queued lazily. */
  resolveCtor?: CtorResolver;
}

/** The parsed body of a `<script type="registry">`: which registries it extends + the tags it defines. */
export interface RegistryScriptDeclaration {
  /** Local IDREFs of other declared-registry scripts this one composes over (#854 IDREF `extends`). */
  extends: string[];
  /** `tag → constructor-reference` map; references resolve via {@link CtorResolver}. */
  define: Record<string, string>;
}

/** A `define` entry awaiting its constructor reference becoming resolvable (the lazy queue, MOMENT 2). */
export interface PendingDefinition {
  tag: string;
  ref: string;
}

/** An installed `<script type="registry">` binding: the built registry + any still-pending definitions. */
export interface RegistryScriptBinding {
  /** The script's `id` (the key for `registry="id"` association), or `null` if unidentified. */
  id: string | null;
  /** The scoped registry this script declared (object-keyed, composes its `extends` by reference). */
  registry: CustomElementRegistry;
  /** Definitions whose constructor reference did not resolve yet — drained by {@link flushPendingDefinitions}. */
  pending: PendingDefinition[];
}

/** Result of {@link applyDeclarativeRegistries}: every installed binding + the id→registry index. */
export interface DeclarativeRegistryResult {
  bindings: RegistryScriptBinding[];
  /** `registry="id"` lookup: script id → the registry it declared. */
  byId: Map<string, CustomElementRegistry>;
}

/** A `<script type="registry">` whose body is not the expected `{ extends?, define? }` shape. */
export class RegistryScriptError extends Error {
  constructor(why: string) {
    super(`<script type="registry"> binding invalid: ${why}`);
    this.name = 'RegistryScriptError';
  }
}

/**
 * Parse one `<script type="registry">` element's JSON body into its `{ extends, define }` declaration.
 * Both keys are optional (a registry may declare definitions, compose existing ones, or both), but the
 * body must be a JSON object; `extends` (if present) must be a string array and `define` (if present) a
 * string→string map. Throws {@link RegistryScriptError} on any violation.
 */
export function parseRegistryScript(script: HTMLScriptElement): RegistryScriptDeclaration {
  const raw = (script.textContent ?? '').trim();
  if (!raw) throw new RegistryScriptError('empty script body');

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    throw new RegistryScriptError(`body is not valid JSON (${(e as Error).message})`);
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
    throw new RegistryScriptError('body must be a JSON object');

  const obj = parsed as Record<string, unknown>;

  let composes: string[] = [];
  if ('extends' in obj) {
    if (!Array.isArray(obj.extends) || obj.extends.some((x) => typeof x !== 'string'))
      throw new RegistryScriptError('"extends" must be an array of registry-script ids');
    composes = obj.extends as string[];
  }

  const define: Record<string, string> = {};
  if ('define' in obj) {
    const d = obj.define;
    if (typeof d !== 'object' || d === null || Array.isArray(d))
      throw new RegistryScriptError('"define" must be a { tag: ctorRef } object');
    for (const [tag, ref] of Object.entries(d as Record<string, unknown>)) {
      if (typeof ref !== 'string')
        throw new RegistryScriptError(`"define"["${tag}"] must be a constructor-reference string`);
      define[tag] = ref;
    }
  }

  return { extends: composes, define };
}

/**
 * Find and install every `<script type="registry">` under `root`, building one scoped
 * {@link CustomElementRegistry} per script. `extends` is wired by local IDREF against the registries built
 * earlier in this scan (declaration order; a forward/unknown reference is skipped with a `console.warn`,
 * leaving the registry standalone). Each `define` whose constructor reference resolves *now* is
 * scoped-defined immediately (dom-less registration into the registry object); the rest are queued in
 * `binding.pending` for {@link flushPendingDefinitions}. Idempotent: an already-installed script is
 * skipped, so this is safe to re-run after DOM/module changes. A malformed block is skipped (never throws
 * for one bad script — the rest still install).
 */
export function applyDeclarativeRegistries(
  root: ParentNode = document,
  opts: DeclarativeRegistryOptions = {},
): DeclarativeRegistryResult {
  const scripts = root.querySelectorAll<HTMLScriptElement>(`script[type="${REGISTRY_SCRIPT_TYPE}"]`);
  const bindings: RegistryScriptBinding[] = [];
  // Seed the id index from the prior scan so successive `applyDeclarativeRegistries` calls (incremental
  // re-scans) can `extends` registries declared in an earlier pass, not just earlier in this DOM walk.
  const byId = new Map<string, CustomElementRegistry>(activeResult?.byId ?? []);

  for (const script of Array.from(scripts)) {
    if (processed.has(script)) continue;

    let decl: RegistryScriptDeclaration;
    try {
      decl = parseRegistryScript(script);
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn(`[declarative-registry] ${(e as Error).message} — skipped.`);
      continue;
    }

    // Compose `extends` by local IDREF against registries already built in this scan.
    const composes: CustomElementRegistry[] = [];
    for (const ref of decl.extends) {
      const parent = byId.get(ref);
      if (parent) composes.push(parent);
      // eslint-disable-next-line no-console
      else console.warn(`[declarative-registry] extends "${ref}" not found (declare it before this script); skipped.`);
    }

    const registry = new CustomElementRegistry({ extends: composes });
    const pending: PendingDefinition[] = [];

    for (const [tag, ref] of Object.entries(decl.define)) {
      const ctor = opts.resolveCtor?.(ref);
      if (ctor) registry.define(tag, ctor);
      else pending.push({ tag, ref });
    }

    processed.add(script);
    const id = script.id || null;
    if (id) byId.set(id, registry);
    bindings.push({ id, registry, pending });
  }

  const result = { bindings, byId };
  activeResult = result;
  return result;
}

/**
 * Drain the lazy queue: re-resolve every still-pending `define` against `resolveCtor`, scoped-defining the
 * ones now available and leaving the rest queued. Call this after a module that backs a deferred reference
 * loads (the MOMENT-2 lazy-queue payoff). Returns the number of definitions newly applied.
 */
export function flushPendingDefinitions(
  result: DeclarativeRegistryResult,
  resolveCtor: CtorResolver,
): number {
  let applied = 0;
  for (const binding of result.bindings) {
    if (!binding.pending.length) continue;
    const stillPending: PendingDefinition[] = [];
    for (const entry of binding.pending) {
      const ctor = resolveCtor(entry.ref);
      if (ctor) {
        binding.registry.define(entry.tag, ctor);
        applied++;
      } else {
        stillPending.push(entry);
      }
    }
    binding.pending = stillPending;
  }
  return applied;
}

/**
 * Resolve the scoped registry an `element` binds to, honouring the #854 association forms:
 *  1. **Local IDREF (primary)** — `registry="<id>"` looks the id up in the declared `byId` index (the #900
 *     attribute; a document-scoped IDREF, never a global namespace).
 *  2. **`{{ expr }}` raw-object bridge** — a value wrapped in `{{ }}` names a raw foreign registry *object*
 *     not declared in markup; `resolveObject` (the webexpressions interpreter in production) yields it.
 *
 * Returns `undefined` when the element carries no `registry=` or the reference doesn't resolve.
 */
export function resolveScopedRegistry(
  result: DeclarativeRegistryResult,
  element: Element,
  resolveObject?: (expr: string) => CustomElementRegistry | undefined,
): CustomElementRegistry | undefined {
  const assoc = element.getAttribute(REGISTRY_ASSOC_ATTR);
  if (!assoc) return undefined;

  const expr = assoc.match(/^\{\{(.+)\}\}$/);
  if (expr) return resolveObject?.(expr[1].trim());

  return result.byId.get(assoc);
}

/**
 * Map a resolved scoped registry through to a consumer `host`'s shadow root — the consumption side of
 * scoped registration (the native `attachShadow({ customElementRegistry })` /
 * `shadowrootcustomelementregistry` path). When the host already has a shadow root, its contents are
 * upgraded against the scoped registry; the registry is also recorded on the host so a later
 * `attachShadow` can adopt it. Returns `true` if a shadow root was upgraded.
 *
 * (In a fully native runtime this is a no-op pass-through — the browser binds the registry at
 * `attachShadow`. This shim covers the polyfilled/declared path until `customElementRegistry` is Baseline.)
 */
export function applyScopedRegistryToHost(host: Element & { shadowRoot?: ShadowRoot | null }, registry: CustomElementRegistry): boolean {
  // Record the registry so a subsequent attachShadow (or a patched one) can adopt it.
  (host as unknown as { [SCOPED_REGISTRY_KEY]?: CustomElementRegistry })[SCOPED_REGISTRY_KEY] = registry;
  if (host.shadowRoot) {
    registry.upgrade(host.shadowRoot);
    return true;
  }
  return false;
}

/** Property key under which a resolved scoped registry is recorded on its consumer host. */
export const SCOPED_REGISTRY_KEY = Symbol('webeverything:scopedRegistry');

/** Read the scoped registry recorded on a host by {@link applyScopedRegistryToHost}, if any. */
export function getScopedRegistryOf(host: Element): CustomElementRegistry | undefined {
  return (host as unknown as { [SCOPED_REGISTRY_KEY]?: CustomElementRegistry })[SCOPED_REGISTRY_KEY];
}

/**
 * The most recent scan's result, so a {@link ScopedRegistryAttribute} binding behavior (which activates
 * per-element at MOMENT 2, decoupled from any one scan call) can resolve its `registry="id"` association.
 * Mirrors how a `CustomAttribute` reaches the closest injector via module-level state. `null` until the
 * first {@link applyDeclarativeRegistries}.
 */
let activeResult: DeclarativeRegistryResult | null = null;

/** The current declared-registry scan result the binding behavior resolves against, or `null`. */
export function getActiveRegistryResult(): DeclarativeRegistryResult | null {
  return activeResult;
}

/**
 * Clear the active scan result so the next {@link applyDeclarativeRegistries} starts a fresh `byId` index
 * (drops the cross-scan `extends` seed). For a full teardown of a declarative-registry session, or test
 * isolation. Does not un-define anything already registered on a live registry object.
 */
export function resetDeclaredRegistries(): void {
  activeResult = null;
}
